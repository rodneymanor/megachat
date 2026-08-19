import { NextRequest, NextResponse } from "next/server";
import { runSetupMigrations, MigrationSetupError } from "@/lib/setup/migrations";
import {
  normalizeSupabaseConnectionString,
  validateSupabaseConnectionString,
} from "@/lib/setup/validation";
import { isSupabaseConfigured } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Runs only MegaChat's checked-in, idempotent migrations. The supplied URI is
 * restricted to Supabase hosts, used for this request, and never persisted or
 * logged. Keeping this route public lets a brand-new deployment initialize its
 * database before authentication tables exist.
 */
export async function POST(request: NextRequest) {
  if (isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "This deployment is already configured. Run the local installer to migrate a different project." },
      { status: 409 },
    );
  }

  let connectionString: unknown;
  try {
    const body = await request.json();
    connectionString = body?.connectionString;
  } catch {
    return NextResponse.json({ error: "Send a JSON setup request." }, { status: 400 });
  }

  if (typeof connectionString !== "string" || connectionString.length > 2_048) {
    return NextResponse.json({ error: "A valid Supabase connection URI is required." }, { status: 400 });
  }

  const validationError = validateSupabaseConnectionString(connectionString);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const result = await runSetupMigrations(normalizeSupabaseConnectionString(connectionString));
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof MigrationSetupError
      ? error.message
      : "Database setup failed unexpectedly. It is safe to try again.";
    const status = error instanceof MigrationSetupError && error.code === "connection" ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
