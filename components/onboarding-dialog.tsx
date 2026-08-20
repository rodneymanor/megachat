"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  Hash,
  Key,
  Loader2,
  Plug,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  serializeGlobalKeywords,
  type GlobalKeywordAction,
  type GlobalKeywordRule,
} from "@/lib/global-keywords";

/**
 * First-run setup for a workspace, shown over the dashboard until it is
 * finished. Everything here is also reachable from Settings, but a new
 * workspace has no Zernio key, no AI Gateway key, and no global keywords —
 * and nothing in the product works without the first of those — so the
 * dialog walks through all three instead of leaving them to be discovered.
 *
 * "Skip for now" only hides the dialog for the current browser session
 * (sessionStorage); the permanent dismissal is `onboarding_completed_at`,
 * written when the last step is finished.
 */

const SESSION_SKIP_KEY = "megachat_onboarding_skipped";

const ZERNIO_API_KEY_URL = "https://zernio.com/dashboard/settings/api";
const ZERNIO_SIGNUP_URL = "https://zernio.com";
const AI_GATEWAY_URL = "https://vercel.com/ai-gateway";
const AI_GATEWAY_KEYS_URL = "https://vercel.com/dashboard/ai-gateway/api-keys";

/** The pair almost every workspace wants, offered as one click on step 3. */
const RECOMMENDED_KEYWORDS: GlobalKeywordRule[] = [
  { keyword: "stop", action: "unsubscribe" },
  { keyword: "start", action: "subscribe" },
];

const ACTION_LABELS: Record<GlobalKeywordAction, string> = {
  unsubscribe: "Unsubscribe them",
  subscribe: "Resubscribe them",
};

interface OnboardingDialogProps {
  workspaceId: string;
  hasZernioKey: boolean;
  hasAiKey: boolean;
  globalKeywords: GlobalKeywordRule[];
  hostedMode: boolean;
}

const STEPS = ["Connect Zernio", "AI replies", "Global keywords"] as const;

export function OnboardingDialog({
  workspaceId,
  hasZernioKey,
  hasAiKey,
  globalKeywords,
  hostedMode,
}: OnboardingDialogProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [dismissed, setDismissed] = useState(true);
  const [step, setStep] = useState(0);

  const [zernioKey, setZernioKey] = useState("");
  const [showZernioKey, setShowZernioKey] = useState(false);
  const [zernioConnected, setZernioConnected] = useState(hasZernioKey);
  const [accountCount, setAccountCount] = useState<number | null>(null);
  const [testing, setTesting] = useState(false);

  const [aiKey, setAiKey] = useState("");
  const [showAiKey, setShowAiKey] = useState(false);
  const [aiSaved, setAiSaved] = useState(hasAiKey);

  const [keywords, setKeywords] = useState<GlobalKeywordRule[]>(globalKeywords);
  const [newKeyword, setNewKeyword] = useState("");
  const [newAction, setNewAction] = useState<GlobalKeywordAction>("unsubscribe");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // sessionStorage is only readable after mount, so the dialog starts hidden
  // and opens on the client — this never renders during SSR anyway.
  useEffect(() => {
    setDismissed(sessionStorage.getItem(SESSION_SKIP_KEY) === "1");
  }, []);

  const skip = useCallback(() => {
    sessionStorage.setItem(SESSION_SKIP_KEY, "1");
    setDismissed(true);
  }, []);

  useEffect(() => {
    if (dismissed) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") skip();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [dismissed, skip]);

  // Settings is where every one of these fields also lives; covering it with
  // the dialog would just hide the thing the user navigated to.
  if (dismissed || pathname?.startsWith("/dashboard/settings")) return null;

  async function testZernioKey() {
    const key = zernioKey.trim();
    if (!key) return;

    setTesting(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/channels/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key, workspaceId }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.error) {
        setError(data.error || `Connection failed (${res.status})`);
        return;
      }

      // The route validates, saves, and syncs channels in one call.
      setZernioConnected(true);
      setAccountCount((data.accounts ?? []).length);
      setZernioKey("");
      router.refresh();
    } catch {
      setError("Could not reach the Zernio API. Check your network connection.");
    } finally {
      setTesting(false);
    }
  }

  async function saveAiKey() {
    const key = aiKey.trim();
    if (!key) return true;

    const res = await fetch("/api/v1/workspace/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, aiKey: key }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || `Failed to save the AI Gateway key (${res.status})`);
      return false;
    }

    setAiSaved(true);
    setAiKey("");
    return true;
  }

  function addKeyword() {
    const keyword = newKeyword.trim().toLowerCase();
    if (!keyword) return;
    setKeywords((prev) =>
      prev.some((k) => k.keyword === keyword)
        ? prev.map((k) => (k.keyword === keyword ? { keyword, action: newAction } : k))
        : [...prev, { keyword, action: newAction }]
    );
    setNewKeyword("");
  }

  function addRecommended() {
    setKeywords((prev) => {
      const merged = [...prev];
      for (const rule of RECOMMENDED_KEYWORDS) {
        const existing = merged.findIndex((k) => k.keyword === rule.keyword);
        if (existing === -1) merged.push(rule);
        else merged[existing] = rule;
      }
      return merged;
    });
  }

  async function goNext() {
    setError(null);

    if (step === 1) {
      setBusy(true);
      const ok = await saveAiKey();
      setBusy(false);
      if (!ok) return;
    }

    setStep((s) => s + 1);
  }

  async function finish() {
    setBusy(true);
    setError(null);

    try {
      const supabase = createClient();

      // global_keywords and onboarding_completed_at are both grant-writable
      // from the browser (migrations 00020 and 00021); keys are not, which is
      // why those went through /api/v1/... above.
      const { error: updateError } = await supabase
        .from("workspaces")
        .update({
          global_keywords: serializeGlobalKeywords(keywords),
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq("id", workspaceId)
        .select("id")
        .single();

      if (updateError) throw new Error(updateError.message);

      setDismissed(true);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save your setup. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  const actionlessKeywords = keywords.filter((k) => k.action === null);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="fixed inset-0 bg-black/60" onClick={skip} />

      <div className="relative z-10 flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg">
        {/* Header + progress */}
        <div className="border-b border-border px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="onboarding-title" className="text-lg font-bold">
                Finish setting up MegaChat
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Three things to set up before your flows can do anything. Takes about
                two minutes.
              </p>
            </div>
            <button
              onClick={skip}
              aria-label="Close setup"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <ol className="mt-5 flex items-center gap-2">
            {STEPS.map((label, index) => (
              <li key={label} className="flex flex-1 items-center gap-2">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                    index < step
                      ? "bg-primary/15 text-primary"
                      : index === step
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {index < step ? <Check className="h-3 w-3" /> : index + 1}
                </span>
                <span
                  className={`truncate text-xs font-medium ${
                    index === step
                      ? "text-foreground"
                      : "hidden text-muted-foreground sm:inline"
                  }`}
                >
                  {label}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {/* Step body */}
        <div className="flex-1 overflow-auto px-6 py-6">
          {step === 0 && (
            <section>
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">
                  Add your Zernio API key
                  <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                    Required
                  </span>
                </h3>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                MegaChat sends and receives every message through Zernio. Until this
                key is here, no channels appear, the Inbox stays empty, and flows have
                nothing to run on.
              </p>
              <ol className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                <li>
                  1. Open your{" "}
                  <a
                    href={ZERNIO_API_KEY_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-primary underline underline-offset-2 hover:opacity-80"
                  >
                    Zernio API settings
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  {" — "}
                  no account yet? Sign up free at{" "}
                  <a
                    href={ZERNIO_SIGNUP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2 hover:opacity-80"
                  >
                    zernio.com
                  </a>
                  .
                </li>
                <li>2. Copy the API key and paste it below.</li>
                <li>3. Press Test &amp; connect — we import your accounts right away.</li>
              </ol>

              {zernioConnected ? (
                <div className="mt-5 flex items-start gap-2 rounded-lg border border-emerald-600/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-600 dark:text-emerald-400">
                  <Check className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Zernio connected
                    {accountCount !== null && (
                      <>
                        {" — "}
                        {accountCount} {accountCount === 1 ? "account" : "accounts"}{" "}
                        imported. Manage them under{" "}
                        <Link
                          href="/dashboard/channels"
                          className="underline underline-offset-2"
                          onClick={skip}
                        >
                          Channels
                        </Link>
                        .
                      </>
                    )}
                  </span>
                </div>
              ) : (
                <>
                  <div className="relative mt-5">
                    <input
                      type={showZernioKey ? "text" : "password"}
                      value={zernioKey}
                      onChange={(e) => setZernioKey(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          testZernioKey();
                        }
                      }}
                      placeholder="Paste your Zernio API key"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 pr-10 font-mono text-sm placeholder:font-sans placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={() => setShowZernioKey(!showZernioKey)}
                      aria-label={showZernioKey ? "Hide key" : "Show key"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showZernioKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  <button
                    onClick={testZernioKey}
                    disabled={!zernioKey.trim() || testing}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {testing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plug className="h-4 w-4" />
                    )}
                    {testing ? "Testing..." : "Test & connect"}
                  </button>
                </>
              )}
            </section>
          )}

          {step === 1 && (
            <section>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">
                  Add an AI Gateway key
                  <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Optional
                  </span>
                </h3>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Only needed for the <strong className="font-medium text-foreground">AI
                Response</strong> node — the one that writes a reply on the fly instead
                of sending fixed text.
                {hostedMode
                  ? " On this hosted instance, AI Response nodes are skipped until you add your own key."
                  : " Flows that only send written-out messages work without it."}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                One{" "}
                <a
                  href={AI_GATEWAY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-primary underline underline-offset-2 hover:opacity-80"
                >
                  Vercel AI Gateway
                  <ExternalLink className="h-3 w-3" />
                </a>{" "}
                key reaches OpenAI, Anthropic, and Google models. It is available on
                every Vercel plan, the free one included: each team gets $5/month of
                gateway credits, then it is pay-as-you-go at provider list price.
                Routing your own OpenAI or Anthropic key through the gateway (BYOK) is
                the one part that needs a paid Vercel plan.
              </p>
              <ol className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                <li>
                  1. Create a key in your{" "}
                  <a
                    href={AI_GATEWAY_KEYS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-primary underline underline-offset-2 hover:opacity-80"
                  >
                    Vercel AI Gateway dashboard
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  .
                </li>
                <li>2. Paste it below, or skip and add it later in Settings.</li>
              </ol>

              {aiSaved && !aiKey ? (
                <div className="mt-5 flex items-center gap-2 rounded-lg border border-emerald-600/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-600 dark:text-emerald-400">
                  <Check className="h-4 w-4 shrink-0" />
                  AI Gateway key saved — AI Response nodes are ready to use.
                </div>
              ) : (
                <div className="relative mt-5">
                  <input
                    type={showAiKey ? "text" : "password"}
                    value={aiKey}
                    onChange={(e) => setAiKey(e.target.value)}
                    placeholder="Paste your AI Gateway API key (optional)"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 pr-10 font-mono text-sm placeholder:font-sans placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAiKey(!showAiKey)}
                    aria-label={showAiKey ? "Hide key" : "Show key"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showAiKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              )}
            </section>
          )}

          {step === 2 && (
            <section>
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">
                  Set your global keywords
                  <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Recommended
                  </span>
                </h3>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                A global keyword is one exact word a contact can DM you to control
                their own subscription. When their message is exactly that word,
                MegaChat runs the action and stops — no flow runs for that message.
                Anything else goes to your flow triggers as usual.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                <strong className="font-medium text-foreground">What to do:</strong>{" "}
                type the word, choose what it should do, and press Add. Most workspaces
                add exactly two: <code className="rounded bg-muted px-1 py-0.5 text-xs">stop</code>{" "}
                to unsubscribe and{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">start</code> to
                resubscribe.
              </p>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addKeyword();
                    }
                  }}
                  placeholder="e.g. stop"
                  aria-label="Keyword"
                  className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <select
                  value={newAction}
                  onChange={(e) => setNewAction(e.target.value as GlobalKeywordAction)}
                  aria-label="What this keyword does"
                  className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="unsubscribe">{ACTION_LABELS.unsubscribe}</option>
                  <option value="subscribe">{ACTION_LABELS.subscribe}</option>
                </select>
                <button
                  onClick={addKeyword}
                  disabled={!newKeyword.trim()}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>

              {keywords.length === 0 ? (
                <button
                  onClick={addRecommended}
                  className="mt-3 text-xs font-medium text-primary underline underline-offset-2 hover:opacity-80"
                >
                  Add the recommended pair (stop / start)
                </button>
              ) : (
                <ul className="mt-4 space-y-2">
                  {keywords.map((rule) => (
                    <li
                      key={rule.keyword}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                          {rule.keyword}
                        </code>
                        <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                          {rule.action
                            ? ACTION_LABELS[rule.action]
                            : "No action set — pick one below"}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <select
                          value={rule.action ?? ""}
                          onChange={(e) =>
                            setKeywords((prev) =>
                              prev.map((k) =>
                                k.keyword === rule.keyword
                                  ? {
                                      ...k,
                                      action: e.target.value as GlobalKeywordAction,
                                    }
                                  : k
                              )
                            )
                          }
                          aria-label={`What "${rule.keyword}" does`}
                          className="rounded-lg border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          {rule.action === null && (
                            <option value="" disabled>
                              Choose an action
                            </option>
                          )}
                          <option value="unsubscribe">{ACTION_LABELS.unsubscribe}</option>
                          <option value="subscribe">{ACTION_LABELS.subscribe}</option>
                        </select>
                        <button
                          onClick={() =>
                            setKeywords((prev) =>
                              prev.filter((k) => k.keyword !== rule.keyword)
                            )
                          }
                          aria-label={`Remove ${rule.keyword}`}
                          className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {actionlessKeywords.length > 0 && (
                <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                  {actionlessKeywords.length === 1
                    ? "One keyword has no action and will be ignored until you pick one."
                    : `${actionlessKeywords.length} keywords have no action and will be ignored until you pick one.`}
                </p>
              )}
            </section>
          )}

          {error && (
            <p className="mt-4 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
          {step > 0 ? (
            <button
              onClick={() => {
                setError(null);
                setStep((s) => s - 1);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          ) : (
            <button
              onClick={skip}
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Skip for now
            </button>
          )}

          <div className="flex items-center gap-3">
            {step === 0 && !zernioConnected && (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                You can add this later in Settings
              </span>
            )}
            {step < STEPS.length - 1 ? (
              <button
                onClick={goNext}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                {step === 0 && !zernioConnected ? "Skip this step" : "Next"}
              </button>
            ) : (
              <button
                onClick={finish}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {busy ? "Saving..." : "Finish setup"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
