import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "pg";

const MIGRATIONS_TABLE = "_megachat_migrations";
const MIGRATION_FILE = /^\d{5}_.+\.sql$/;
const ADVISORY_LOCK_NAME = "megachat_web_setup";

export interface MigrationResult {
  applied: number;
  skipped: number;
  total: number;
}

export class MigrationSetupError extends Error {
  constructor(
    message: string,
    public readonly code: "connection" | "migration",
  ) {
    super(message);
    this.name = "MigrationSetupError";
  }
}

function friendlyConnectionError(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "";

  if (code === "28P01") return "Supabase rejected the database password. Copy a fresh Session pooler URI and replace [YOUR-PASSWORD].";
  if (["ENOTFOUND", "ENETUNREACH", "EAI_AGAIN"].includes(code)) {
    return "The database host could not be reached. In Supabase, choose the Session pooler URI on port 5432.";
  }
  if (code === "ETIMEDOUT") return "The database connection timed out. Try the Session pooler URI on port 5432.";
  return "MegaChat could not connect to Supabase. Check the connection URI and database password.";
}

export async function runSetupMigrations(connectionString: string): Promise<MigrationResult> {
  const migrationsDir = join(process.cwd(), "supabase", "migrations");
  const files = (await readdir(migrationsDir)).filter((file) => MIGRATION_FILE.test(file)).sort();
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 12_000,
  });

  try {
    try {
      await client.connect();
    } catch (error) {
      throw new MigrationSetupError(friendlyConnectionError(error), "connection");
    }

    await client.query("SELECT pg_advisory_lock(hashtext($1))", [ADVISORY_LOCK_NAME]);
    await client.query(
      `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
        filename text primary key,
        applied_at timestamptz not null default now()
      )`,
    );

    const { rows } = await client.query<{ filename: string }>(`SELECT filename FROM ${MIGRATIONS_TABLE}`);
    const appliedFiles = new Set(rows.map((row) => row.filename));
    let applied = 0;
    let skipped = 0;

    for (const file of files) {
      if (appliedFiles.has(file)) {
        skipped += 1;
        continue;
      }

      const sql = await readFile(join(migrationsDir, file), "utf8");
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query(`INSERT INTO ${MIGRATIONS_TABLE} (filename) VALUES ($1)`, [file]);
        await client.query("COMMIT");
        applied += 1;
      } catch {
        await client.query("ROLLBACK").catch(() => undefined);
        throw new MigrationSetupError(
          `Database setup stopped at ${file}. Nothing after that migration was applied; it is safe to try again.`,
          "migration",
        );
      }
    }

    return { applied, skipped, total: files.length };
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext($1))", [ADVISORY_LOCK_NAME]).catch(() => undefined);
    await client.end().catch(() => undefined);
  }
}
