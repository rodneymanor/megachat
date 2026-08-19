#!/usr/bin/env node
/**
 * MegaChat: activate/manage hosted-mode billing for a workspace.
 *
 * `workspace_billing` (migration 00018) is service-role only -- nothing in
 * the app can flip it from the browser, on purpose. Until Stripe is wired
 * up, this script IS the activation flow: run it after a customer pays, and
 * a future Stripe webhook will just upsert the same table this script does.
 *
 * Usage:
 *   node scripts/activate-workspace.mjs <slug-or-owner-email>
 *   node scripts/activate-workspace.mjs jane@example.com
 *   node scripts/activate-workspace.mjs my-workspace-slug
 *   node scripts/activate-workspace.mjs jane@example.com --deactivate
 *   node scripts/activate-workspace.mjs jane@example.com --cap 200
 *   node scripts/activate-workspace.mjs --open-signups
 *   node scripts/activate-workspace.mjs --close-signups
 *   node scripts/activate-workspace.mjs --help
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ---------------------------------------------------------------------------
// Small helpers: colors, printing (matches scripts/setup.mjs)
// ---------------------------------------------------------------------------

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = paint("1");
const dim = paint("2");
const red = paint("31");
const green = paint("32");
const cyan = paint("36");

const say = (msg = "") => console.log(msg);
const ok = (msg) => say(`  ${green("✔")} ${msg}`);
const err = (msg) => say(`  ${red("✗")} ${msg}`);
const info = (msg) => say(`  ${dim(msg)}`);

function printHelp() {
  say(`${bold("MegaChat: activate-workspace")}

Manually activates (or deactivates) hosted-mode billing for a workspace.
Stand-in for Stripe until that's wired up -- a future webhook will upsert
the same workspace_billing table this script does.

${bold("Usage")}
  node scripts/activate-workspace.mjs <slug-or-owner-email>   Activate (1 year)
  node scripts/activate-workspace.mjs <target> --deactivate    Set status to cancelled
  node scripts/activate-workspace.mjs <target> --cap <n>       Set dm_daily_cap
  node scripts/activate-workspace.mjs --open-signups           Allow new signups
  node scripts/activate-workspace.mjs --close-signups          Block new signups
  node scripts/activate-workspace.mjs --help                   Show this help

${bold("Target")}
  Either a workspace slug, or the email of one of its members (the first
  workspace that member belongs to is used).
`);
}

// ---------------------------------------------------------------------------
// .env loading (no dotenv dependency; matches scripts/smoke-test.mjs)
// ---------------------------------------------------------------------------

function loadEnv() {
  const envPath = resolve(ROOT, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const val = trimmed.slice(eq + 1);
    if (!process.env[key]) process.env[key] = val;
  }
}

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const flags = {
    deactivate: false,
    cap: undefined,
    openSignups: false,
    closeSignups: false,
    help: false,
  };
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") flags.help = true;
    else if (arg === "--deactivate") flags.deactivate = true;
    else if (arg === "--open-signups") flags.openSignups = true;
    else if (arg === "--close-signups") flags.closeSignups = true;
    else if (arg === "--cap") {
      const value = argv[++i];
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        err(`--cap expects a positive number, got: ${value ?? "(nothing)"}`);
        process.exit(1);
      }
      flags.cap = parsed;
    } else if (arg.startsWith("--")) {
      err(`Unknown flag: ${arg}`);
      printHelp();
      process.exit(1);
    } else {
      positional.push(arg);
    }
  }

  return { flags, target: positional[0] };
}

// ---------------------------------------------------------------------------
// Workspace resolution
// ---------------------------------------------------------------------------

function isEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

/** Finds a user by email via the admin API (no direct auth.users access via PostgREST). */
async function findUserByEmail(supabase, email) {
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      err(`Failed to list users: ${error.message}`);
      process.exit(1);
    }
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (data.users.length < perPage) return null; // last page
  }
}

async function resolveWorkspace(supabase, target) {
  if (isEmail(target)) {
    const user = await findUserByEmail(supabase, target);
    if (!user) {
      err(`No user found with email ${target}`);
      process.exit(1);
    }

    const { data: membership, error } = await supabase
      .from("workspace_members")
      .select("workspace_id, workspaces(id, name, slug)")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (error || !membership?.workspaces) {
      err(`User ${target} (${user.id}) has no workspace membership.`);
      process.exit(1);
    }

    return membership.workspaces;
  }

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select("id, name, slug")
    .eq("slug", target)
    .single();

  if (error || !workspace) {
    err(`No workspace found with slug "${target}"`);
    process.exit(1);
  }

  return workspace;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { flags, target } = parseArgs(process.argv.slice(2));

  if (flags.help) {
    printHelp();
    process.exit(0);
  }

  loadEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    err("Missing NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY.");
    info("Set them in .env, or export them in your shell before running this script.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Instance-wide signup toggle -- no workspace target needed.
  if (flags.openSignups || flags.closeSignups) {
    const allow = flags.openSignups;
    const { data, error } = await supabase
      .from("instance_config")
      .update({ allow_signups: allow })
      .eq("id", 1)
      .select()
      .single();

    if (error) {
      err(`Failed to update instance_config: ${error.message}`);
      process.exit(1);
    }

    ok(`Signups are now ${allow ? green("open") : red("closed")} on this instance.`);
    say(dim(JSON.stringify(data, null, 2)));

    if (!target) process.exit(0);
  }

  if (!target) {
    printHelp();
    process.exit(1);
  }

  say(bold(cyan(`\n  Resolving workspace for "${target}"...`)));
  const workspace = await resolveWorkspace(supabase, target);
  ok(`Workspace: ${workspace.name} (${workspace.slug}) — ${workspace.id}`);

  const patch = {
    workspace_id: workspace.id,
  };

  if (flags.deactivate) {
    patch.status = "cancelled";
  } else {
    patch.status = "active";
    const oneYearFromNow = new Date();
    oneYearFromNow.setDate(oneYearFromNow.getDate() + 365);
    patch.current_period_end = oneYearFromNow.toISOString();
  }

  if (flags.cap !== undefined) {
    patch.dm_daily_cap = flags.cap;
  }

  const { data: billing, error } = await supabase
    .from("workspace_billing")
    .upsert(patch, { onConflict: "workspace_id" })
    .select()
    .single();

  if (error) {
    err(`Failed to upsert workspace_billing: ${error.message}`);
    process.exit(1);
  }

  ok(
    flags.deactivate
      ? `Workspace ${red("deactivated")}.`
      : `Workspace ${green("activated")}.`
  );
  say(dim(JSON.stringify(billing, null, 2)));
}

main().catch((e) => {
  err(`Unexpected error: ${e?.stack || e}`);
  process.exit(1);
});
