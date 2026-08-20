"use client";

import { useState } from "react";
import {
  Settings,
  Key,
  Hash,
  Save,
  Plus,
  X,
  Check,
  Eye,
  EyeOff,
  Plug,
  Loader2,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  serializeGlobalKeywords,
  type GlobalKeywordAction,
  type GlobalKeywordRule,
} from "@/lib/global-keywords";

const ACTION_LABELS: Record<GlobalKeywordAction, string> = {
  unsubscribe: "Unsubscribe them",
  subscribe: "Resubscribe them",
};

interface WorkspaceSettings {
  id: string;
  name: string;
  hasApiKey: boolean;
  hasAiKey: boolean;
  globalKeywords: GlobalKeywordRule[];
  hostedMode: boolean;
}

interface TestResult {
  success: boolean;
  accountCount?: number;
  error?: string;
}

export function SettingsView({
  workspace,
}: {
  workspace: WorkspaceSettings;
}) {
  const [name, setName] = useState(workspace.name);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [aiKey, setAiKey] = useState("");
  const [showAiKey, setShowAiKey] = useState(false);
  const [keywords, setKeywords] = useState<GlobalKeywordRule[]>(
    workspace.globalKeywords
  );
  const [newKeyword, setNewKeyword] = useState("");
  const [newAction, setNewAction] = useState<GlobalKeywordAction>("unsubscribe");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  function addKeyword() {
    const keyword = newKeyword.trim().toLowerCase();
    if (!keyword) return;
    setKeywords((prev) =>
      prev.some((k) => k.keyword === keyword)
        ? prev.map((k) =>
            k.keyword === keyword ? { keyword, action: newAction } : k
          )
        : [...prev, { keyword, action: newAction }]
    );
    setNewKeyword("");
  }

  function setKeywordAction(keyword: string, action: GlobalKeywordAction) {
    setKeywords((prev) =>
      prev.map((k) => (k.keyword === keyword ? { ...k, action } : k))
    );
  }

  function removeKeyword(keyword: string) {
    setKeywords((prev) => prev.filter((k) => k.keyword !== keyword));
  }

  async function handleTestConnection() {
    const keyToTest = apiKey.trim();
    if (!keyToTest) return;

    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/v1/channels/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: keyToTest, workspaceId: workspace.id }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setTestResult({
          success: false,
          error: data.error || `Connection failed (${res.status})`,
        });
        return;
      }

      const accounts = data.accounts || [];
      setTestResult({
        success: true,
        accountCount: accounts.length,
      });

      // Key was saved and channels synced server-side
      setApiKey("");
    } catch {
      setTestResult({
        success: false,
        error: "Could not reach the Zernio API. Please check your network connection.",
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const supabase = createClient();

      // name/global_keywords are grant-writable straight from the browser
      // (migration 00020). Keys go through the server-side route below —
      // the browser has no write access to those columns any more.
      const { error: updateError } = await supabase
        .from("workspaces")
        .update({
          name: name.trim(),
          global_keywords: serializeGlobalKeywords(keywords),
        })
        .eq("id", workspace.id)
        .select("id")
        .single();

      if (updateError) {
        console.error("Settings save error:", updateError);
        throw new Error(updateError.message);
      }

      const trimmedApiKey = apiKey.trim();
      const trimmedAiKey = aiKey.trim();
      if (trimmedApiKey || trimmedAiKey) {
        const res = await fetch("/api/v1/workspace/keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId: workspace.id,
            ...(trimmedApiKey ? { zernioKey: trimmedApiKey } : {}),
            ...(trimmedAiKey ? { aiKey: trimmedAiKey } : {}),
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Failed to save keys (${res.status})`);
        }
      }

      setSaved(true);
      setApiKey("");
      setAiKey("");
      setTestResult(null);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Failed to save settings:", err);
      setError(err instanceof Error ? err.message : "Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-8 py-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your workspace settings
        </p>
      </div>

      {/* Settings form */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-2xl space-y-8 px-8 py-8">
          {/* Workspace name */}
          <section>
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">General</h2>
            </div>
            <div className="mt-4">
              <label className="text-xs font-medium text-muted-foreground">
                Workspace Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </section>

          <hr className="border-border" />

          {/* Zernio API Key */}
          <section>
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Zernio API Key</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Your Zernio API key is used to connect with social media platforms.
              {workspace.hasApiKey && " A key is currently configured."}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              You can get your API key from your{" "}
              <a
                href="https://zernio.com/dashboard/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-primary underline underline-offset-2 hover:opacity-80"
              >
                Zernio dashboard
                <ExternalLink className="h-3 w-3" />
              </a>
              . Sign up at{" "}
              <a
                href="https://zernio.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:opacity-80"
              >
                zernio.com
              </a>{" "}
              if you don&apos;t have an account yet.
            </p>

            <div className="mt-4 relative">
              <input
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  // Clear test result when key changes
                  if (testResult) setTestResult(null);
                }}
                placeholder={
                  workspace.hasApiKey
                    ? "Enter a new key to replace the current one"
                    : "Enter your Zernio API key"
                }
                className="w-full rounded-lg border border-input bg-background px-3 py-2 pr-10 text-sm font-mono placeholder:text-muted-foreground placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* Test Connection button */}
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={handleTestConnection}
                disabled={!apiKey.trim() || testing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plug className="h-3.5 w-3.5" />
                )}
                {testing ? "Testing..." : "Test Connection"}
              </button>

              {testResult && testResult.success && (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <Check className="h-3.5 w-3.5" />
                  Connected ({testResult.accountCount}{" "}
                  {testResult.accountCount === 1 ? "account" : "accounts"}{" "}
                  found)
                </span>
              )}

              {testResult && !testResult.success && (
                <span className="text-xs text-red-600">
                  {testResult.error}
                </span>
              )}
            </div>

            {workspace.hasApiKey && !testResult && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-green-600">
                <Check className="h-3 w-3" />
                API key configured
              </p>
            )}
          </section>

          <hr className="border-border" />

          {/* AI Gateway API Key */}
          <section>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">AI Gateway</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {workspace.hostedMode ? (
                "Required on this hosted instance — AI Response nodes are skipped until you add your own AI Gateway key. "
              ) : (
                "Required for the AI Response flow node. "
              )}
              Uses{" "}
              <a
                href="https://vercel.com/ai-gateway"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-primary underline underline-offset-2 hover:opacity-80"
              >
                Vercel AI Gateway
                <ExternalLink className="h-3 w-3" />
              </a>{" "}
              to access OpenAI, Anthropic, and Google models with a single key.
              {workspace.hasAiKey && " A key is currently configured."}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Available on every Vercel plan, the free one included: each team gets
              $5/month of gateway credits, then it is pay-as-you-go at provider list
              price. Routing your own OpenAI or Anthropic key through the gateway
              (BYOK) is the one part that requires a paid Vercel plan.
            </p>

            <div className="mt-4 relative">
              <input
                type={showAiKey ? "text" : "password"}
                value={aiKey}
                onChange={(e) => setAiKey(e.target.value)}
                placeholder={
                  workspace.hasAiKey
                    ? "Enter a new key to replace the current one"
                    : "Enter your AI Gateway API key"
                }
                className="w-full rounded-lg border border-input bg-background px-3 py-2 pr-10 text-sm font-mono placeholder:text-muted-foreground placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowAiKey(!showAiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showAiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            {workspace.hasAiKey && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-green-600">
                <Check className="h-3 w-3" />
                AI Gateway key configured
              </p>
            )}
          </section>

          <hr className="border-border" />

          {/* Global Keywords */}
          <section>
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Global Keywords</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              A global keyword is one exact word a contact can DM you to control their
              own subscription. When their message is exactly that word, MegaChat runs
              the action and stops — no flow runs for that message. Everything else
              goes to your flow triggers as usual.
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">What to do:</span> type the
              word, choose what it should do, and press Add. Most workspaces add exactly
              two: <code className="rounded bg-muted px-1 py-0.5">stop</code> to
              unsubscribe and <code className="rounded bg-muted px-1 py-0.5">start</code>{" "}
              to resubscribe. Matching ignores case and surrounding spaces, but the whole
              message has to be the keyword — &ldquo;please stop&rdquo; does not match.
            </p>

            {/* Keyword input */}
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
                onChange={(e) =>
                  setNewAction(e.target.value as GlobalKeywordAction)
                }
                aria-label="What this keyword does"
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="unsubscribe">{ACTION_LABELS.unsubscribe}</option>
                <option value="subscribe">{ACTION_LABELS.subscribe}</option>
              </select>
              <button
                onClick={addKeyword}
                disabled={!newKeyword.trim()}
                aria-label="Add keyword"
                className="rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground hover:opacity-90 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Keyword list */}
            {keywords.length > 0 ? (
              <ul className="mt-3 space-y-2">
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
                          : "No action set — this keyword is ignored"}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <select
                        value={rule.action ?? ""}
                        onChange={(e) =>
                          setKeywordAction(
                            rule.keyword,
                            e.target.value as GlobalKeywordAction
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
                        <option value="unsubscribe">
                          {ACTION_LABELS.unsubscribe}
                        </option>
                        <option value="subscribe">
                          {ACTION_LABELS.subscribe}
                        </option>
                      </select>
                      <button
                        onClick={() => removeKeyword(rule.keyword)}
                        aria-label={`Remove ${rule.keyword}`}
                        className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground/70">
                No global keywords yet — contacts have no way to unsubscribe
                themselves until you add one.
              </p>
            )}
          </section>

          <hr className="border-border" />

          {/* Save button */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>

            {saved && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <Check className="h-4 w-4" />
                Settings saved
              </span>
            )}

            {error && (
              <span className="text-sm text-red-600">
                {error}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
