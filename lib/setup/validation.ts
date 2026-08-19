export interface SetupValues {
  supabaseUrl: string;
  publishableKey: string;
  secretKey: string;
  connectionString: string;
}

export type SetupErrors = Partial<Record<keyof SetupValues, string>>;

const LEGACY_JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.length > 3;
  } catch {
    return false;
  }
}

export function normalizeSupabaseProjectUrl(value: string): string {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? url.origin : trimmed;
  } catch {
    return trimmed.replace(/\/$/, "");
  }
}

export function normalizeSupabaseConnectionString(value: string): string {
  const trimmed = value.trim();
  try {
    return new URL(trimmed).toString();
  } catch {
    return trimmed;
  }
}

export function validateSetupValues(values: SetupValues): SetupErrors {
  const errors: SetupErrors = {};

  if (!isHttpsUrl(normalizeSupabaseProjectUrl(values.supabaseUrl))) {
    errors.supabaseUrl = "Paste the HTTPS project URL from Supabase.";
  }

  const publishableKey = values.publishableKey.trim();
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey) && !LEGACY_JWT.test(publishableKey)) {
    errors.publishableKey = "Use a publishable key, or the legacy anon key.";
  }

  const secretKey = values.secretKey.trim();
  if (!/^sb_secret_[A-Za-z0-9_-]+$/.test(secretKey) && !LEGACY_JWT.test(secretKey)) {
    errors.secretKey = "Use a secret key, or the legacy service_role key.";
  }

  const connectionError = validateSupabaseConnectionString(values.connectionString);
  if (connectionError) errors.connectionString = connectionError;

  return errors;
}

/**
 * Restricts the public migration endpoint to Supabase Postgres hosts. This
 * prevents the setup helper from becoming a general-purpose SSRF proxy.
 */
export function validateSupabaseConnectionString(value: string): string | null {
  if (!value.trim() || value.includes("[YOUR-PASSWORD]")) {
    return "Paste the connection URI and replace [YOUR-PASSWORD].";
  }

  try {
    const url = new URL(value.trim());
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
      return "The connection URI must start with postgres:// or postgresql://.";
    }
    if (!url.username || !url.password) {
      return "The connection URI must include the database username and password.";
    }
    const host = url.hostname.toLowerCase();
    if (!host.endsWith(".pooler.supabase.com")) {
      return "For safety, web setup only connects to a Supabase Session pooler host.";
    }
    if (!/^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(host)) {
      return "Copy the Session pooler URI from Supabase; its host looks like aws-0-region.pooler.supabase.com.";
    }
    if (url.port !== "5432") return "Choose the Session pooler URI on port 5432.";
    if (!/^postgres\.[a-z0-9]+$/i.test(url.username)) {
      return "Copy the complete Session pooler URI; its username starts with postgres.project-ref.";
    }
    if (url.pathname !== "/postgres") return "The Session pooler URI must connect to the postgres database.";
  } catch {
    return "Paste a valid Postgres connection URI from Supabase.";
  }

  return null;
}
