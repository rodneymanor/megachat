#!/usr/bin/env node
/**
 * MegaChat setup
 *
 * Interactive installer that gets a fresh clone running end to end:
 *   1. Collects your Supabase project credentials
 *   2. Generates a CRON_SECRET
 *   3. Runs every SQL migration against your database (idempotent)
 *   4. Writes .env
 *
 * Usage:
 *   node scripts/setup.mjs            interactive setup
 *   npm run setup                     same thing, via package.json
 *   node scripts/setup.mjs --dry-run  validate input + discover migrations,
 *                                     no database connection, no files written
 *   node scripts/setup.mjs --help     show this help
 */

import { createInterface } from "node:readline/promises";
import { readdirSync, readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");
const ENV_PATH = join(ROOT, ".env");
const MIGRATIONS_TABLE = "_megachat_migrations";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const HELP = args.includes("--help") || args.includes("-h");

// ---------------------------------------------------------------------------
// Small helpers: colors, printing
// ---------------------------------------------------------------------------

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = paint("1");
const dim = paint("2");
const red = paint("31");
const green = paint("32");
const yellow = paint("33");
const cyan = paint("36");

const say = (msg = "") => console.log(msg);
const step = (n, total, msg) => say(`\n${bold(cyan(`[${n}/${total}]`))} ${bold(msg)}`);
const ok = (msg) => say(`  ${green("✔")} ${msg}`);
const warn = (msg) => say(`  ${yellow("⚠")} ${msg}`);
const err = (msg) => say(`  ${red("✗")} ${msg}`);
const info = (msg) => say(`  ${dim(msg)}`);

function printHelp() {
  say(`${bold("MegaChat setup")}

Interactive installer that connects a Supabase project, runs database
migrations, and writes your .env file.

${bold("Usage")}
  node scripts/setup.mjs            Run the interactive installer
  npm run setup                     Same thing, via package.json

${bold("Options")}
  --dry-run     Validate input formats and discover migration files.
                Does not connect to a database or write any files.
  --help, -h    Show this help and exit.
`);
}

if (HELP) {
  printHelp();
  process.exit(0);
}

// Readline over piped stdin answers the first prompt, then exits 0 without
// finishing -- a false success. Require a real terminal instead.
if (!process.stdin.isTTY) {
  err("This installer is interactive and needs a real terminal (stdin is not a TTY).");
  info("Run `node scripts/setup.mjs` directly in a terminal, without piping input.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Validation (loose on purpose -- self-hosters may have custom domains,
// and Supabase has shipped more than one API key format over the years)
// ---------------------------------------------------------------------------

function isHttpsUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === "https:" && u.hostname.length > 3;
  } catch {
    return false;
  }
}

function isSupabaseKeyish(str) {
  if (!str || str.length < 20) return false;
  // Legacy Supabase keys are JWTs: three base64url segments.
  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(str)) return true;
  // Newer Supabase key formats.
  if (/^sb_(publishable|secret)_[A-Za-z0-9_-]+$/.test(str)) return true;
  return false;
}

function isPgConnectionString(str) {
  return /^postgres(ql)?:\/\/[^\s:]+:[^\s@]+@[^\s/]+\/[^\s?]+/i.test(str);
}

function mask(secret) {
  if (!secret) return "";
  if (secret.length <= 8) return secret[0] + "•".repeat(Math.max(3, secret.length - 1));
  return secret.slice(0, 8) + "…" + "•".repeat(6);
}

// ---------------------------------------------------------------------------
// Prompting
// ---------------------------------------------------------------------------

async function promptUntilValid(rl, { label, hint, validate, maskEcho = false, maxAttempts = 5 }) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const raw = await rl.question(`  ${label}: `);
    const value = raw.trim();
    if (validate(value)) {
      if (value) info(`    -> ${maskEcho ? mask(value) : value}`);
      return value;
    }
    err(`Doesn't look right${hint ? ` -- ${hint}` : ""}. Try again (${attempt}/${maxAttempts}).`);
  }
  err("Too many invalid attempts. Exiting.");
  process.exitCode = 1;
  rl.close();
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Migration discovery + execution
// ---------------------------------------------------------------------------

function discoverMigrations() {
  if (!existsSync(MIGRATIONS_DIR)) return [];
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{5}_.+\.sql$/.test(f)) // excludes ALL_MIGRATIONS.sql on purpose
    .sort();
}

function describeSqlError(sql, error) {
  const lines = [`    ${red("Postgres error:")} ${error.message}`];
  if (error.code) lines.push(`    ${dim(`code: ${error.code}`)}`);
  if (typeof error.position === "number") {
    const upTo = sql.slice(0, Number(error.position));
    const lineNo = upTo.split("\n").length;
    const colNo = upTo.length - upTo.lastIndexOf("\n");
    lines.push(`    ${dim(`at line ${lineNo}, column ${colNo}`)}`);
    const context = sql.split("\n").slice(Math.max(0, lineNo - 2), lineNo + 1).join("\n");
    lines.push(context.split("\n").map((l) => `      ${dim(l)}`).join("\n"));
  }
  return lines.join("\n");
}

async function runMigrations({ connectionString }) {
  const files = discoverMigrations();
  if (files.length === 0) {
    warn(`No migration files found in ${MIGRATIONS_DIR}`);
    return;
  }

  const pgModule = await import("pg");
  const { Client } = pgModule.default ?? pgModule;
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
  } catch (e) {
    err(`Could not connect to the database: ${e.message}`);
    err("Double-check the connection string (Project Settings -> Database -> Connection string -> URI).");
    process.exitCode = 1;
    process.exit(1);
  }
  ok("Connected to database.");

  await client.query(
    `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
       filename text primary key,
       applied_at timestamptz not null default now()
     )`
  );

  const { rows } = await client.query(`SELECT filename FROM ${MIGRATIONS_TABLE}`);
  const applied = new Set(rows.map((r) => r.filename));

  let appliedCount = 0;
  let skippedCount = 0;

  for (const file of files) {
    if (applied.has(file)) {
      info(`skip  ${file} (already applied)`);
      skippedCount++;
      continue;
    }

    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(`INSERT INTO ${MIGRATIONS_TABLE} (filename) VALUES ($1)`, [file]);
      await client.query("COMMIT");
      ok(`applied ${file}`);
      appliedCount++;
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      err(`Migration failed: ${file}`);
      say(describeSqlError(sql, e));
      say(`\n  ${yellow("Nothing after this file was applied.")} Fix the issue above and re-run`);
      say(`  ${dim("node scripts/setup.mjs")} -- already-applied migrations are skipped automatically.`);
      await client.end();
      process.exitCode = 1;
      process.exit(1);
    }
  }

  await client.end();
  ok(`Migrations complete: ${appliedCount} applied, ${skippedCount} already up to date.`);
}

// ---------------------------------------------------------------------------
// .env writing
// ---------------------------------------------------------------------------

function buildEnvContent({ supabaseUrl, anonKey, serviceRoleKey, cronSecret }) {
  return `# Generated by scripts/setup.mjs on ${new Date().toISOString()}
# Re-run "node scripts/setup.mjs" any time to regenerate this file.

# Supabase -- Project Settings -> API
NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}
SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}

# Your Zernio API key is NOT stored here -- paste it into the app's Settings
# page after you register an account (free at https://zernio.com).

# AI Gateway (optional, for the AI Response flow node)
# Self-hosted: create a key at https://vercel.com/ai-gateway and set it below.
# Deployed on Vercel: leave this unset, OIDC handles auth automatically.
# AI_GATEWAY_API_KEY=

# Authorizes requests to /api/cron/jobs (fires flow Delay-node timers).
CRON_SECRET=${cronSecret}

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
`;
}

function writeEnvFile(content) {
  if (existsSync(ENV_PATH)) {
    let backupPath = join(ROOT, ".env.backup");
    if (existsSync(backupPath)) {
      backupPath = join(ROOT, `.env.backup.${Date.now()}`);
    }
    copyFileSync(ENV_PATH, backupPath);
    warn(`Existing .env found -- backed it up to ${backupPath.replace(ROOT + "/", "")}`);
  }
  writeFileSync(ENV_PATH, content, "utf8");
  ok(`Wrote .env`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const TOTAL_STEPS = DRY_RUN ? 4 : 5;

  say(bold(cyan("\n  MegaChat setup")));
  say(dim("  Self-hosted comment-to-DM automation, powered by Zernio.\n"));
  if (DRY_RUN) say(yellow("  Running in --dry-run mode: no database connection, no files written.\n"));

  say("  You'll need a free Supabase project. If you don't have one yet:");
  say(`    1. Go to ${cyan("https://supabase.com/dashboard")} and create a new project`);
  say("    2. Wait for it to finish provisioning (~2 minutes)");
  say("    3. Come back here with these three values ready:");
  say(`         ${bold("Project Settings -> API")}      -> Project URL, anon key, service_role key`);
  say(`         ${bold("Project Settings -> Database")} -> Connection string -> URI`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const cancel = () => {
    say(`\n\n${yellow("Setup cancelled.")}`);
    rl.close();
    process.exit(130);
  };
  process.on("SIGINT", cancel);

  let supabaseUrl, anonKey, serviceRoleKey, dbUrl;

  try {
    step(1, TOTAL_STEPS, "Supabase project credentials");
    supabaseUrl = await promptUntilValid(rl, {
      label: "Project URL (e.g. https://abcdefgh.supabase.co)",
      hint: "must be an https:// URL",
      validate: (v) => isHttpsUrl(v),
    });
    anonKey = await promptUntilValid(rl, {
      label: "anon / publishable key",
      hint: "expected a Supabase API key (JWT or sb_publishable_...)",
      validate: (v) => isSupabaseKeyish(v),
      maskEcho: true,
    });
    serviceRoleKey = await promptUntilValid(rl, {
      label: "service_role / secret key",
      hint: "expected a Supabase API key (JWT or sb_secret_...)",
      validate: (v) => isSupabaseKeyish(v),
      maskEcho: true,
    });
    dbUrl = await promptUntilValid(rl, {
      label: "Postgres connection string (URI, direct or pooler)",
      hint: "expected something like postgresql://user:pass@host:5432/postgres",
      validate: (v) => isPgConnectionString(v),
      maskEcho: true,
    });

    step(2, TOTAL_STEPS, "Generating CRON_SECRET");
    const cronSecret = randomBytes(24).toString("base64url");
    ok(`Generated (${mask(cronSecret)})`);

    step(3, TOTAL_STEPS, "Database migrations");
    const files = discoverMigrations();
    ok(`Found ${files.length} migration file${files.length === 1 ? "" : "s"} in supabase/migrations/`);
    files.forEach((f) => info(f));

    if (DRY_RUN) {
      info("[dry-run] would connect and apply any files not yet in " + MIGRATIONS_TABLE);
    } else {
      await runMigrations({ connectionString: dbUrl });
    }

    step(4, TOTAL_STEPS, "Writing .env");
    const envContent = buildEnvContent({ supabaseUrl, anonKey, serviceRoleKey, cronSecret });
    if (DRY_RUN) {
      info("[dry-run] would write .env with keys: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,");
      info("          SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET, NEXT_PUBLIC_APP_URL");
    } else {
      writeEnvFile(envContent);
      info("Remember: these same values go into Vercel -> Project -> Settings ->");
      info("Environment Variables when you deploy.");
    }

    if (!DRY_RUN) {
      step(5, TOTAL_STEPS, "Done");
    } else {
      step(4, TOTAL_STEPS, "Dry run complete");
    }

    if (DRY_RUN) {
      say(`\n${green(bold("Dry run passed."))} Re-run without --dry-run to actually set things up.\n`);
    } else {
      say(`\n${green(bold("Setup complete!"))}\n`);
      say("  Next steps:");
      say(`    1. ${cyan("npm run dev")}`);
      say(`    2. Open ${cyan("http://localhost:3000")}`);
      say("    3. Register an account");
      say("    4. Settings -> paste your Zernio API key");
      say(`       (free at ${cyan("https://zernio.com")} for up to 2 connected accounts)`);
      say("    5. Connect Instagram on the Channels page");
      say("    6. Build your first comment-to-DM flow");
      say("\n  Deploying to Vercel?");
      say("    Push this repo to GitHub, then use the Deploy to Vercel button in");
      say("    the README (or `vercel deploy`). Add the same NEXT_PUBLIC_SUPABASE_URL,");
      say("    NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, and");
      say("    CRON_SECRET values in Vercel -> Project -> Settings -> Environment Variables.\n");
    }
  } finally {
    process.off("SIGINT", cancel);
    rl.close();
  }
}

main().catch((e) => {
  err(`Unexpected error: ${e?.stack || e}`);
  process.exit(1);
});
