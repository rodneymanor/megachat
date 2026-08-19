# MegaChat

**The open-source Instagram comment-to-DM engine. Comment a keyword, get a DM. Self-host it free.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Frodneymanor%2Fmegachat&project-name=megachat&repository-name=megachat)

I got tired of paying a monthly bill for one feature: someone comments a keyword on my post, they get a DM. That's the whole job. So this is that feature, self-hosted, running on free tiers, and yours.

## What it does

- **Comment-to-DM** — someone comments your keyword on an Instagram post, MegaChat DMs them automatically
- **Visual flow builder** — drag-and-drop the conversation: messages, buttons, quick replies, conditions, delays
- **Live inbox** — real-time conversations with human takeover when you want to jump in
- **Contact CRM** — every person who ever DMs you, with tags, custom fields, and segments
- **AI replies** — optional AI response node (bring your own OpenAI / Anthropic / Google key)
- **Webhooks & HTTP** — pipe captured leads into anything else you run

## What it costs

**$0 if you're a creator with one or two accounts.**

| Piece | Free tier |
|---|---|
| Hosting (Vercel) | Free — Hobby plan runs the app (see cron note below) |
| Database + auth (Supabase) | Free tier is plenty |
| Instagram API ([Zernio](https://zernio.com)) | Free up to 2 connected accounts |

Zernio handles the hard part — Meta OAuth, token refresh, rate limits, webhooks — so you never touch the Meta developer console.

## Easiest setup: Vercel + the setup page

No terminal or SQL editor is required.

1. Create a free [Supabase project](https://supabase.com/dashboard) and save the database password you choose.
2. Click **Deploy with Vercel** above. Vercel creates your own Git copy and deploys it.
3. Open the new deployment. A fresh MegaChat instance automatically opens `/setup`.
4. Follow the direct Supabase links beside the four fields, paste the values, and click **Initialize database**.
5. Copy the generated environment block. In Vercel, open **Settings → Environment Variables** and paste the block for Production, Preview, and Development.
6. If a deployment already exists, accept **Redeploy**. If Vercel says **No Production Deployment**, push `main` to GitHub (or import the repository with **Add New → Project**) to create the first deployment—an empty project cannot be redeployed.
7. Open the deployed app, register the owner account, and add your Zernio key in **Settings**.

The setup page does not store credentials. It sends the Postgres URI once to your own deployment to run MegaChat's checked-in migrations; the other values stay in the browser until you copy them to Vercel.

Need to deploy a modified fork or upload this repository through GitHub? See the exact [Vercel upload steps](SETUP.md#upload-your-own-megachat-repository-to-vercel).

## Local quick start (10 minutes)

**Prerequisites:** Node 18+, a free [Supabase](https://supabase.com) project, a free [Zernio](https://zernio.com) API key.

```bash
git clone https://github.com/rodneymanor/megachat.git
cd megachat
npm install
npm run setup
npm run dev
```

`npm run setup` is the terminal version of the web setup: it walks you through the same Supabase credentials, runs all database migrations, and writes your `.env`.

Want to see every question the installer asks — and exactly where each answer lives in the Supabase dashboard — before you run it? Read the [Setup Guide](SETUP.md).

> **Why do some migrations mention sequences, broadcasts, or WhatsApp?** MegaChat keeps its database schema identical to upstream [ZernFlow](https://github.com/zernio-dev/zernflow), so upstream fixes merge cleanly. Tables for features this build doesn't ship just sit empty — they cost nothing.

Then open [http://localhost:3000](http://localhost:3000):

1. Register an account
2. **Settings** → paste your Zernio API key
3. **Channels** → connect Instagram (OAuth, ~30 seconds)
4. **Flows** → build your first comment-to-DM automation

## Vercel cron note

The included `vercel.json` uses one daily scheduler run so deployment succeeds on Vercel Hobby. Instant replies and comment-to-DM do not use the scheduler and remain instant; only flow **Delay** steps wait for the scheduler. Vercel Pro users can change the schedule to `* * * * *` for per-minute processing.

## Deployment modes

Your deployment is public on the internet, so by default it's **single-tenant**: the first account you register becomes the owner, and the database blocks every signup after that — email and GitHub OAuth both. Without this, anyone who found your URL could register on it and start burning your Supabase and Zernio quota. Nothing to configure — it's on the moment you run the installer. Adding a teammate later is a one-line SQL toggle; see [SETUP.md](SETUP.md#one-instance-one-owner).

The same codebase can also power a hosted MegaChat instance, switched on by two env vars self-hosters can ignore: `HOSTED_MODE` (turns on activation gating) and `DAILY_DM_CAP` (per-workspace daily send quota). Neither removes or gates a feature — they are deployment configuration, not an open-core split. Leave them unset and you get the full app, every feature, forever.

API keys (Zernio, AI Gateway) are written to the database server-side only. `ENCRYPTION_KEY` encrypts them at rest; the web setup generates this value automatically, while local terminal setups can add it optionally.

## How it works

```
Instagram comment ──▶ Zernio webhook ──▶ /api/webhooks/late
                                              │
                                    keyword match? ──▶ flow engine ──▶ DM sent
                                              │
                                        contact saved ──▶ inbox / CRM
```

- **Next.js 16** (App Router) — app, API routes, flow engine
- **Supabase** — Postgres, auth, row-level security
- **Zernio** — Instagram messaging API layer
- **React Flow** — the visual builder

```
app/          pages + API routes (setup, dashboard, webhooks, cron)
components/   flow builder, inbox, CRM UI
lib/          flow engine, comment processor, triggers, scheduler
supabase/     migrations (the setup script applies these for you)
scripts/      setup.mjs (terminal installer) + smoke-test.mjs
```

## Part of the Megaphone system

MegaChat catches the DMs. [Megaphone](https://rodmanor.com) makes the videos that get the comments. They're built to run together, but MegaChat is fully standalone — no account, no upsell wall, MIT licensed. You can also find it on the [Rod Manor downloads page](https://rodmanor.com/downloads).

## Credits

MegaChat is a focused fork of [ZernFlow](https://github.com/zernio-dev/zernflow) (MIT), the open-source ManyChat alternative by the [Zernio](https://zernio.com) team — stripped to the Instagram comment-to-DM core and rebranded. If you want the full multi-platform suite (7 platforms, broadcasts, drip sequences, teams), use the original.

## License

[MIT](LICENSE) — fork it, ship it, sell with it.
