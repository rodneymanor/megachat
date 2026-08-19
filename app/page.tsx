import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  GitBranch,
  MessageSquare,
  Users,
  MessageCircle,
  CheckCircle,
  TrendingUp,
  Github,
  Sparkles,
  Server,
} from "lucide-react";
import { signupsAllowed } from "@/lib/instance-config";

const GITHUB_URL = "https://github.com/rodneymanor/megachat";

export default async function Home() {
  const open = await signupsAllowed();

  return (
    <div className="min-h-screen bg-[#0C0B0B] text-[#F2EFEA]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-[#F2EFEA]/12 bg-[#0C0B0B]/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="MegaChat" width={28} height={28} className="rounded-lg" />
            <span className="font-display text-base font-bold tracking-tight text-[#F2EFEA]">MegaChat</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-[#F2EFEA]/62 hover:text-[#F2EFEA] sm:inline-flex"
            >
              <Github className="h-4 w-4" />
              Star on GitHub
            </Link>
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm text-[#F2EFEA]/62 hover:text-[#F2EFEA]"
            >
              Log in
            </Link>
            <Link
              href={open ? "/register" : "/login"}
              className="rounded-lg bg-[#FF3A1D] px-4 py-2 text-sm font-medium text-[#2A0A05] hover:bg-[#E22E14]"
            >
              {open ? "Get started free" : "Sign in"}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-20 sm:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#F2EFEA]/12 px-4 py-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#F2EFEA]/62">MIT Licensed</span>
            <Link
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-[#FF3A1D] hover:opacity-80"
            >
              View on GitHub <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <h1 className="font-display text-4xl font-black uppercase leading-[0.92] tracking-[-0.015em] text-[#F2EFEA] sm:text-5xl lg:text-6xl">
            Comment a keyword.{" "}
            <span className="text-[#FF3A1D]">Get a DM.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-[#F2EFEA]/62">
            MegaChat is the open-source Instagram comment-to-DM engine. Self-host it free
            on your own infrastructure, or run it locally in minutes.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={open ? "/register" : "/login"}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#FF3A1D] px-6 py-3 text-sm font-medium text-[#2A0A05] shadow-sm hover:bg-[#E22E14] sm:w-auto"
            >
              {open ? "Get started free" : "Sign in"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#F2EFEA]/12 bg-transparent px-6 py-3 text-sm font-medium text-[#F2EFEA] hover:bg-[#141312] sm:w-auto"
            >
              <Github className="h-4 w-4" />
              View source code
            </Link>
          </div>
          <p className="mt-4 text-xs text-[#F2EFEA]/40">MIT licensed. Self-host for free. No credit card required.</p>
        </div>

        {/* Flow builder preview */}
        <div className="mx-auto mt-16 max-w-4xl">
          <div className="overflow-hidden rounded-2xl border border-[#F2EFEA]/12 bg-[#141312] shadow-xl">
            <div className="flex items-center gap-2 border-b border-[#F2EFEA]/12 bg-[#0C0B0B] px-4 py-3">
              <div className="h-2.5 w-2.5 rounded-full bg-[#F2EFEA]/20" />
              <div className="h-2.5 w-2.5 rounded-full bg-[#F2EFEA]/20" />
              <div className="h-2.5 w-2.5 rounded-full bg-[#F2EFEA]/20" />
              <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[#F2EFEA]/40">Welcome Flow</span>
            </div>
            <div className="relative flex min-h-[300px] items-center justify-center gap-4 p-8 sm:gap-6 sm:p-12"
              style={{
                backgroundImage: "radial-gradient(circle, rgba(242,239,234,0.08) 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            >
              {/* Trigger */}
              <div className="w-40 rounded-xl border border-[#F2EFEA]/12 bg-[#0C0B0B] p-4">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#FF3A1D]/10">
                    <MessageCircle className="h-3.5 w-3.5 text-[#FF3A1D]" />
                  </div>
                  <span className="text-xs font-semibold text-[#F2EFEA]">Comment trigger</span>
                </div>
                <p className="text-[10px] text-[#F2EFEA]/40">Keyword: &quot;info&quot;</p>
              </div>

              <div className="hidden h-0.5 w-6 bg-[#F2EFEA]/12 sm:block" />

              {/* Send DM */}
              <div className="hidden w-44 rounded-xl border border-[#F2EFEA]/12 bg-[#0C0B0B] p-4 sm:block">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#FF3A1D]/10">
                    <MessageSquare className="h-3.5 w-3.5 text-[#FF3A1D]" />
                  </div>
                  <span className="text-xs font-semibold text-[#F2EFEA]">Send DM</span>
                </div>
                <p className="text-[10px] text-[#F2EFEA]/40">&quot;Hey! Here&apos;s the link...&quot;</p>
              </div>

              <div className="hidden h-0.5 w-6 bg-[#F2EFEA]/12 sm:block" />

              {/* Tag */}
              <div className="w-36 rounded-xl border border-[#F2EFEA]/12 bg-[#0C0B0B] p-4">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#FF3A1D]/10">
                    <Users className="h-3.5 w-3.5 text-[#FF3A1D]" />
                  </div>
                  <span className="text-xs font-semibold text-[#F2EFEA]">Tag as lead</span>
                </div>
                <p className="text-[10px] text-[#F2EFEA]/40">Tag: &quot;interested&quot;</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Powered by Zernio strip */}
      <section className="border-y border-[#F2EFEA]/12 bg-[#141312] py-6">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-center font-mono text-[10px] uppercase tracking-[0.2em] text-[#F2EFEA]/40">
            Powered by Zernio &middot; free up to 2 connected Instagram accounts
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-2xl font-bold tracking-tight text-[#F2EFEA] sm:text-3xl">
              Everything you need to automate Instagram DMs
            </h2>
          </div>
          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-[#F2EFEA]/12 bg-[#F2EFEA]/12 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: MessageCircle,
                title: "Comment-to-DM",
                desc: "Someone comments a keyword? Instantly DM them your link, offer, or lead magnet.",
              },
              {
                icon: GitBranch,
                title: "Visual flow builder",
                desc: "Drag-and-drop conversation flows. Welcome messages, follow-ups, conditions. No code.",
              },
              {
                icon: MessageSquare,
                title: "Live inbox",
                desc: "All your DMs in one place. The bot handles the easy stuff, you take over when it matters.",
              },
              {
                icon: Users,
                title: "Contact CRM",
                desc: "Tag your audience and build segments. Right message to the right people.",
              },
              {
                icon: Sparkles,
                title: "AI replies",
                desc: "Let AI handle conversations. Bring your own API key, your choice of provider.",
              },
              {
                icon: Server,
                title: "Self-hosted",
                desc: "Deploy on Vercel and Supabase free tiers. Your server, your data, your rules.",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="bg-[#0C0B0B] p-6">
                  <Icon className="mb-3 h-5 w-5 text-[#FF3A1D]" />
                  <h3 className="text-sm font-semibold text-[#F2EFEA]">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#F2EFEA]/62">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Open source section */}
      <section className="border-t border-[#F2EFEA]/12 bg-[#141312] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#F2EFEA]/12 px-3 py-1">
                <Github className="h-3.5 w-3.5 text-[#F2EFEA]/62" />
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#F2EFEA]/62">MIT licensed</span>
              </div>
              <h2 className="font-display text-2xl font-bold tracking-tight text-[#F2EFEA] sm:text-3xl">
                Open source. Not open-washing.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-[#F2EFEA]/62">
                MegaChat is fully open source under the MIT license. Read every line of code,
                self-host on your own infrastructure, or fork it and make it yours.
                No &ldquo;open core&rdquo; tricks, no paywalled features.
              </p>
              <p className="mt-3 text-base leading-relaxed text-[#F2EFEA]/62">
                Your automations, your contacts, your data. You own everything.
                No vendor lock-in, ever.
              </p>
              <div className="mt-6">
                <Link
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-[#FF3A1D] hover:opacity-80"
                >
                  <Github className="h-4 w-4" />
                  Star us on GitHub
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
            <div className="space-y-3">
              {[
                { label: "Free forever", detail: "No monthly fees. No per-account charges. No feature limits." },
                { label: "Self-hostable", detail: "Deploy on Vercel and Supabase free tiers. Clone the repo, set your env vars, ship." },
                { label: "Powered by Zernio", detail: "Free up to 2 connected accounts. Zernio handles the Instagram API for you." },
                { label: "Community-driven", detail: "Built in public. PRs welcome. Roadmap shaped by users, not investors." },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-[#F2EFEA]/12 px-5 py-4">
                  <p className="text-sm font-semibold text-[#F2EFEA]">{item.label}</p>
                  <p className="mt-0.5 text-sm text-[#F2EFEA]/62">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center font-display text-2xl font-bold tracking-tight text-[#F2EFEA] sm:text-3xl">
            Up and running in 5 minutes
          </h2>
          <div className="mx-auto mt-14 grid max-w-3xl gap-10 sm:grid-cols-3">
            {[
              {
                step: "1",
                icon: CheckCircle,
                title: "Connect Instagram",
                desc: "Link your Instagram account through Zernio in a few clicks.",
              },
              {
                step: "2",
                icon: GitBranch,
                title: "Build a flow",
                desc: "Use the visual builder to create your automation. Pick a trigger, add messages, set conditions.",
              },
              {
                step: "3",
                icon: TrendingUp,
                title: "Watch it run",
                desc: "Your flow runs 24/7. Capture leads, answer questions, and reply while you sleep.",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.step} className="text-center">
                  <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#FF3A1D]/10">
                    <Icon className="h-5 w-5 text-[#FF3A1D]" />
                  </div>
                  <h3 className="text-sm font-semibold text-[#F2EFEA]">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#F2EFEA]/62">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="rounded-2xl border border-[#F2EFEA]/12 bg-[#141312] p-10 sm:p-14">
            <div className="mx-auto max-w-xl text-center">
              <h2 className="font-display text-2xl font-bold tracking-tight text-[#F2EFEA] sm:text-3xl">
                Stop losing leads in your comments
              </h2>
              <p className="mt-3 text-sm text-[#F2EFEA]/62">
                Self-host MegaChat, connect your Instagram account, and go live.
                Free forever, open source, MIT licensed.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href={open ? "/register" : "/login"}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#FF3A1D] px-6 py-3 text-sm font-medium text-[#2A0A05] hover:bg-[#E22E14]"
                >
                  {open ? "Get started free" : "Sign in"}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-[#F2EFEA]/12 px-6 py-3 text-sm font-medium text-[#F2EFEA] hover:bg-[#0C0B0B]"
                >
                  <Github className="h-4 w-4" />
                  Star on GitHub
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#F2EFEA]/12 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#F2EFEA]/40">MegaChat</span>
            <span className="text-sm text-[#F2EFEA]/20">|</span>
            <Link
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-[#F2EFEA]/40 hover:text-[#F2EFEA]/62"
            >
              <Github className="h-3.5 w-3.5" />
              GitHub
            </Link>
            <Link
              href="https://zernio.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/powered-by-zernio.svg" alt="Powered by Zernio" className="h-10" />
            </Link>
          </div>
          <p className="text-xs text-[#F2EFEA]/40">
            Open source, MIT licensed
          </p>
        </div>
      </footer>
    </div>
  );
}
