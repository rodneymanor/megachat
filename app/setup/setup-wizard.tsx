"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Check,
  Clipboard,
  Database,
  Download,
  Eye,
  EyeOff,
  Github,
  KeyRound,
  LoaderCircle,
  Rocket,
  ShieldCheck,
} from "lucide-react";
import {
  normalizeSupabaseConnectionString,
  normalizeSupabaseProjectUrl,
  type SetupErrors,
  type SetupValues,
  validateSetupValues,
} from "@/lib/setup/validation";

const LINKS = {
  github: "https://github.com/rodneymanor/megachat",
  supabase: "https://supabase.com/dashboard",
  dataApi: "https://supabase.com/dashboard/project/_/settings/api",
  apiKeys: "https://supabase.com/dashboard/project/_/settings/api-keys",
  database: "https://supabase.com/dashboard/project/_/settings/database",
  vercel: "https://vercel.com/dashboard",
  deploy:
    "https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Frodneymanor%2Fmegachat&project-name=megachat&repository-name=megachat",
} as const;

const EMPTY_VALUES: SetupValues = {
  supabaseUrl: "",
  publishableKey: "",
  secretKey: "",
  connectionString: "",
};

interface MigrationResult {
  applied: number;
  skipped: number;
  total: number;
}

interface SetupWizardProps {
  configured: boolean;
}

interface SetupFieldProps {
  id: keyof SetupValues;
  label: string;
  description: string;
  placeholder: string;
  value: string;
  error?: string;
  secret?: boolean;
  link: string;
  linkLabel: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--setup-text)] underline decoration-[var(--setup-border)] underline-offset-4 transition-colors hover:decoration-[var(--setup-accent)] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--setup-accent)]"
    >
      {children}
      <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
    </a>
  );
}

function SetupField({
  id,
  label,
  description,
  placeholder,
  value,
  error,
  secret = false,
  link,
  linkLabel,
  onChange,
  onBlur,
}: SetupFieldProps) {
  const [visible, setVisible] = useState(false);
  const describedBy = `${id}-description${error ? ` ${id}-error` : ""}`;

  return (
    <div className="grid gap-3 border-t border-[var(--setup-border)] py-7 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:gap-10">
      <div>
        <label htmlFor={id} className="block text-sm font-bold text-[var(--setup-text)]">
          {label}
        </label>
        <p id={`${id}-description`} className="mt-2 max-w-sm text-sm leading-6 text-[var(--setup-muted-text)]">
          {description}
        </p>
        <div className="mt-3">
          <ExternalLink href={link}>{linkLabel}</ExternalLink>
        </div>
      </div>
      <div className="self-center">
        <div className="relative">
          <input
            id={id}
            name={id}
            type={secret && !visible ? "password" : "text"}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onBlur={onBlur}
            placeholder={placeholder}
            autoComplete={secret ? "new-password" : "one-time-code"}
            autoCapitalize="none"
            spellCheck={false}
            data-1p-ignore="true"
            data-lpignore="true"
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            className="min-h-12 w-full rounded-lg border border-[var(--setup-border)] bg-[var(--setup-surface-raised)] px-3.5 py-3 pr-12 font-mono text-xs text-[var(--setup-text)] outline-none transition-colors placeholder:text-[var(--setup-faint-text)] focus:border-[var(--setup-accent)] focus:ring-2 focus:ring-[var(--setup-accent)]/25"
          />
          {secret ? (
            <button
              type="button"
              onClick={() => setVisible((current) => !current)}
              className="absolute right-1.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-[var(--setup-muted-text)] transition-colors hover:bg-[var(--setup-surface)] hover:text-[var(--setup-text)] focus-visible:outline-2 focus-visible:outline-[var(--setup-accent)]"
              aria-label={visible ? `Hide ${label}` : `Show ${label}`}
            >
              {visible ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
            </button>
          ) : null}
        </div>
        {error ? (
          <p id={`${id}-error`} className="mt-2 text-sm text-[var(--setup-danger)]">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function makeSecret(bytes: number): string {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  let binary = "";
  values.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function buildEnvironmentBlock(values: SetupValues, cronSecret: string, encryptionKey: string): string {
  return [
    `NEXT_PUBLIC_SUPABASE_URL=${normalizeSupabaseProjectUrl(values.supabaseUrl)}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${values.publishableKey.trim()}`,
    `SUPABASE_SERVICE_ROLE_KEY=${values.secretKey.trim()}`,
    `CRON_SECRET=${cronSecret}`,
    `ENCRYPTION_KEY=${encryptionKey}`,
  ].join("\n");
}

function ProgressItem({ number, label, state }: { number: number; label: string; state: "done" | "active" | "next" }) {
  return (
    <li className="flex items-center gap-3 lg:items-start">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] font-bold ${
          state === "done"
            ? "border-[var(--setup-success)] bg-[var(--setup-success-soft)] text-[var(--setup-success)]"
            : state === "active"
              ? "border-[var(--setup-accent)] bg-[var(--setup-accent)] text-[var(--setup-accent-ink)]"
              : "border-[var(--setup-border)] text-[var(--setup-faint-text)]"
        }`}
      >
        {state === "done" ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : number}
      </span>
      <span className={`pt-1 text-sm ${state === "next" ? "text-[var(--setup-faint-text)]" : "text-[var(--setup-text)]"}`}>
        {label}
      </span>
    </li>
  );
}

export default function SetupWizard({ configured }: SetupWizardProps) {
  const [values, setValues] = useState<SetupValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<SetupErrors>({});
  const [migration, setMigration] = useState<MigrationResult | null>(null);
  const [cronSecret, setCronSecret] = useState("");
  const [encryptionKey, setEncryptionKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const environmentBlock = useMemo(
    () => (migration ? buildEnvironmentBlock(values, cronSecret, encryptionKey) : ""),
    [encryptionKey, cronSecret, migration, values],
  );

  const currentStep = configured ? 3 : migration ? 2 : 1;

  function updateValue(key: keyof SetupValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setRequestError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedValues = {
      ...values,
      supabaseUrl: normalizeSupabaseProjectUrl(values.supabaseUrl),
      connectionString: normalizeSupabaseConnectionString(values.connectionString),
    };
    setValues(normalizedValues);
    const nextErrors = validateSetupValues(normalizedValues);
    setErrors(nextErrors);
    setRequestError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    const nextCronSecret = cronSecret || makeSecret(24);
    const nextEncryptionKey = encryptionKey || makeSecret(32);
    setCronSecret(nextCronSecret);
    setEncryptionKey(nextEncryptionKey);

    try {
      const response = await fetch("/api/setup/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionString: normalizedValues.connectionString }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Database setup failed.");
      setMigration(body as MigrationResult);
      setValues((current) => ({ ...current, connectionString: "" }));
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Database setup failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyEnvironment() {
    await navigator.clipboard.writeText(environmentBlock);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_000);
  }

  function downloadEnvironment() {
    const file = new Blob([`${environmentBlock}\n`], { type: "text/plain" });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = ".env.local";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="setup-page min-h-screen bg-[var(--setup-background)] text-[var(--setup-text)]">
      <header className="border-b border-[var(--setup-border)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5 focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--setup-accent)]">
            <Image src="/logo.png" alt="" width={30} height={30} className="rounded-md" />
            <span className="font-display text-sm font-bold tracking-tight">MegaChat</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            {configured ? (
              <span className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--setup-success)] sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--setup-success)]" /> Runtime connected
              </span>
            ) : null}
            <ExternalLink href={LINKS.github}>
              <Github aria-hidden="true" className="h-3.5 w-3.5" /> Source
            </ExternalLink>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 pb-24 pt-12 sm:px-8 sm:pt-16">
        <section className="max-w-3xl">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--setup-accent)]">
            Self-hosted setup
          </p>
          <h1 className="mt-4 font-display text-4xl font-black leading-[0.98] tracking-[-0.035em] sm:text-5xl md:text-6xl">
            {configured ? (
              <>Deployment connected.<br />Create your owner account.</>
            ) : (
              <>Four Supabase values.<br />One working MegaChat.</>
            )}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--setup-muted-text)] sm:text-lg">
            {configured
              ? "MegaChat can reach Supabase and the runtime secrets are loaded. Registration is the last step before connecting Instagram."
              : "Open each linked Supabase screen, paste the matching value, and MegaChat will initialize its database. Your credentials go only to this deployment and your Supabase project."}
          </p>
        </section>

        {configured ? (
          <section className="mt-12 max-w-3xl rounded-xl border border-[var(--setup-success)]/45 bg-[var(--setup-surface)] px-5 py-7 sm:px-7 sm:py-9">
            <div className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--setup-success-soft)] text-[var(--setup-success)]">
                <ShieldCheck aria-hidden="true" className="h-5 w-5" />
              </span>
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--setup-success)]">Runtime connected</p>
                <h2 className="mt-2 text-xl font-bold">Your deployment is ready</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--setup-muted-text)]">
                  The first registered account becomes this instance&apos;s owner. Additional public signups are blocked automatically.
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Link href="/register" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--setup-success)] px-5 py-2.5 text-sm font-bold text-[var(--setup-accent-ink)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--setup-success)]">
                    Register owner account <KeyRound aria-hidden="true" className="h-4 w-4" />
                  </Link>
                  <Link href="/" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--setup-border)] px-5 py-2.5 text-sm font-semibold text-[var(--setup-text)] transition-colors hover:bg-[var(--setup-surface-raised)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--setup-accent)]">
                    Return to MegaChat
                  </Link>
                </div>
              </div>
            </div>
          </section>
        ) : (
        <div className="mt-12 grid gap-10 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-14">
          <aside className="lg:sticky lg:top-8 lg:self-start">
            <ol className="flex flex-wrap gap-x-6 gap-y-3 lg:flex-col lg:gap-5">
              <ProgressItem number={1} label="Connect Supabase" state={currentStep > 1 ? "done" : "active"} />
              <ProgressItem number={2} label="Copy deployment values" state={currentStep > 2 ? "done" : currentStep === 2 ? "active" : "next"} />
              <ProgressItem number={3} label="Deploy and register" state={currentStep === 3 ? "active" : "next"} />
            </ol>

            <div className="mt-8 border-l-2 border-[var(--setup-border)] pl-4 text-sm leading-6 text-[var(--setup-muted-text)]">
              Starting from GitHub?
              <div className="mt-2">
                <ExternalLink href={LINKS.deploy}>Deploy a fresh copy</ExternalLink>
              </div>
            </div>
          </aside>

          <div className="min-w-0">
            <form autoComplete="off" onSubmit={handleSubmit} className="rounded-xl border border-[var(--setup-border)] bg-[var(--setup-surface)] px-5 sm:px-7">
              <div className="flex items-start justify-between gap-6 py-7">
                <div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--setup-accent)]">Step 01</p>
                  <h2 className="mt-2 text-xl font-bold">Connect your Supabase project</h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--setup-muted-text)]">
                    Don&apos;t have one yet? Create a free project and save the database password you choose.
                  </p>
                </div>
                <Database aria-hidden="true" className="mt-1 hidden h-6 w-6 shrink-0 text-[var(--setup-muted-text)] sm:block" />
              </div>

              <div className="pb-1">
                <ExternalLink href={LINKS.supabase}>Create or open a Supabase project</ExternalLink>
              </div>

              <SetupField
                id="supabaseUrl"
                label="Project URL"
                description="The HTTPS project URL. If you paste a /rest/v1 endpoint, MegaChat removes that suffix automatically."
                placeholder="https://abcdefgh.supabase.co"
                value={values.supabaseUrl}
                error={errors.supabaseUrl}
                link={LINKS.dataApi}
                linkLabel="Open Data API settings"
                onChange={(value) => updateValue("supabaseUrl", value)}
                onBlur={() => updateValue("supabaseUrl", normalizeSupabaseProjectUrl(values.supabaseUrl))}
              />
              <SetupField
                id="publishableKey"
                label="Publishable key"
                description="Safe for browser authentication. Legacy projects can use the anon key."
                placeholder="sb_publishable_..."
                value={values.publishableKey}
                error={errors.publishableKey}
                link={LINKS.apiKeys}
                linkLabel="Open API keys"
                onChange={(value) => updateValue("publishableKey", value)}
              />
              <SetupField
                id="secretKey"
                label="Secret key"
                description="Server-only access for MegaChat. Legacy projects can use service_role."
                placeholder="sb_secret_..."
                value={values.secretKey}
                error={errors.secretKey}
                secret
                link={LINKS.apiKeys}
                linkLabel="Open API keys"
                onChange={(value) => updateValue("secretKey", value)}
              />
              <SetupField
                id="connectionString"
                label="Session pooler URI"
                description="Choose Session pooler on port 5432, then replace [YOUR-PASSWORD] in the copied URI. Used once to install the database schema."
                placeholder="postgresql://postgres.project:password@...pooler.supabase.com:5432/postgres"
                value={values.connectionString}
                error={errors.connectionString}
                secret
                link={LINKS.database}
                linkLabel="Open database settings"
                onChange={(value) => updateValue("connectionString", value)}
                onBlur={() => updateValue("connectionString", normalizeSupabaseConnectionString(values.connectionString))}
              />

              <div className="border-t border-[var(--setup-border)] py-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex max-w-md items-start gap-2 text-xs leading-5 text-[var(--setup-muted-text)]">
                    <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--setup-success)]" />
                    Credentials are not saved by this page. The connection URI is sent once to this deployment to run the checked-in migrations.
                  </p>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[var(--setup-accent)] px-5 py-2.5 text-sm font-bold text-[var(--setup-accent-ink)] transition-colors hover:bg-[var(--setup-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--setup-accent)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Database aria-hidden="true" className="h-4 w-4" />}
                    {submitting ? "Initializing database…" : "Initialize database"}
                  </button>
                </div>
                {requestError ? (
                  <div role="alert" className="mt-5 rounded-lg border border-[var(--setup-danger)]/40 bg-[var(--setup-danger-soft)] px-4 py-3 text-sm text-[var(--setup-danger)]">
                    {requestError}
                  </div>
                ) : null}
              </div>
            </form>

            {migration ? (
              <section className="mt-8 rounded-xl border border-[var(--setup-success)]/45 bg-[var(--setup-surface)] px-5 py-7 sm:px-7">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--setup-success-soft)] text-[var(--setup-success)]">
                    <Check aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--setup-success)]">Database ready</p>
                    <h2 className="mt-1 text-xl font-bold">Now connect the deployment</h2>
                    <p className="mt-2 text-sm leading-6 text-[var(--setup-muted-text)]">
                      {migration.applied} migrations applied, {migration.skipped} already current. Copy this block into Vercel; MegaChat generated the two secrets for you.
                    </p>
                  </div>
                </div>

                <pre className="mt-6 max-h-72 overflow-auto rounded-lg border border-[var(--setup-border)] bg-[var(--setup-background)] p-4 font-mono text-[11px] leading-6 text-[var(--setup-muted-text)]"><code>{environmentBlock}</code></pre>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={copyEnvironment}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--setup-accent)] px-4 py-2.5 text-sm font-bold text-[var(--setup-accent-ink)] transition-colors hover:bg-[var(--setup-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--setup-accent)]"
                  >
                    {copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <Clipboard aria-hidden="true" className="h-4 w-4" />}
                    {copied ? "Copied" : "Copy Vercel values"}
                  </button>
                  <button
                    type="button"
                    onClick={downloadEnvironment}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--setup-border)] px-4 py-2.5 text-sm font-semibold text-[var(--setup-text)] transition-colors hover:bg-[var(--setup-surface-raised)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--setup-accent)]"
                  >
                    <Download aria-hidden="true" className="h-4 w-4" /> Download .env.local
                  </button>
                </div>

                <div className="mt-8 border-t border-[var(--setup-border)] pt-7">
                  <div className="flex gap-3">
                    <Rocket aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[var(--setup-accent)]" />
                    <div>
                      <h3 className="font-bold">Finish in Vercel</h3>
                      <ol className="mt-3 space-y-2 text-sm leading-6 text-[var(--setup-muted-text)]">
                        <li><strong className="text-[var(--setup-text)]">1.</strong> Open your MegaChat project → Settings → Environment Variables.</li>
                        <li><strong className="text-[var(--setup-text)]">2.</strong> Paste the copied block, apply it to Production, Preview, and Development, then save.</li>
                        <li><strong className="text-[var(--setup-text)]">3.</strong> If Vercel already has a deployment, accept the Redeploy prompt.</li>
                        <li><strong className="text-[var(--setup-text)]">4.</strong> If Vercel says <em>No Production Deployment</em>, push this repository&apos;s <code>main</code> branch to GitHub to create the first deployment. There is nothing to redeploy until that first build exists.</li>
                        <li><strong className="text-[var(--setup-text)]">5.</strong> When the deployment finishes, open MegaChat and register the owner account.</li>
                      </ol>
                      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                        <a
                          href={LINKS.vercel}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--setup-border)] px-4 py-2.5 text-sm font-semibold text-[var(--setup-text)] transition-colors hover:bg-[var(--setup-surface-raised)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--setup-accent)]"
                        >
                          Open Vercel dashboard <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        </div>
        )}
      </div>
    </main>
  );
}
