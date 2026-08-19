# MegaChat Setup Guide

**Total time: ~10 minutes. Total cost: $0.**

You'll create two free accounts, run one command, and answer four questions in the terminal. This page tells you exactly what the terminal will ask for and exactly where to find each answer — so you can have everything ready before you start.

---

## Before you start

You need three things:

| What | Where | Cost |
|---|---|---|
| **Node.js 18+** | [nodejs.org](https://nodejs.org) (download the LTS version) | Free |
| **A Supabase project** | [supabase.com/dashboard](https://supabase.com/dashboard) → **New project** | Free tier |
| **A Zernio account** | [zernio.com](https://zernio.com) → sign up | Free up to 2 Instagram accounts |

**Supabase** is your database — it stores your contacts, conversations, and flows. **Zernio** is the Instagram layer — it handles Meta's OAuth, tokens, and webhooks so you never touch the Meta developer console.

> **Create the Supabase project first.** It takes ~2 minutes to provision, and when you create it you'll set a **database password** — save it, you'll need it in Step 4 below.

---

## Run the installer

```bash
git clone https://github.com/rodneymanor/megachat.git
cd megachat
npm install
npm run setup
```

`npm run setup` is an interactive installer. It asks four questions, then does everything else itself — generates your cron secret, runs every database migration, and writes your `.env` file. No SQL editor, no copy-pasting config.

---

## The four things the terminal will ask for

All four come from your Supabase dashboard. Keep it open in a browser tab.

### 1. Project URL

> `Project URL (e.g. https://abcdefgh.supabase.co)`

**Where:** Supabase dashboard → **Project Settings → Data API**
**Direct link:** [supabase.com/dashboard/project/_/settings/api](https://supabase.com/dashboard/project/_/settings/api)

Copy the **Project URL** at the top of the page. It looks like `https://abcdefgh.supabase.co`.

### 2. Anon / publishable key

> `anon / publishable key`

**Where:** Supabase dashboard → **Project Settings → API Keys**
**Direct link:** [supabase.com/dashboard/project/_/settings/api-keys](https://supabase.com/dashboard/project/_/settings/api-keys)

Copy the key labeled **anon** (older projects) or **publishable** (newer projects — starts with `sb_publishable_`). Either works. This key is safe to expose to browsers.

### 3. Service role / secret key

> `service_role / secret key`

**Where:** Same page as #2 — [supabase.com/dashboard/project/_/settings/api-keys](https://supabase.com/dashboard/project/_/settings/api-keys)

Copy the key labeled **service_role** (click to reveal it) or **secret** (starts with `sb_secret_`). This one is private — the installer masks it as you paste, and it only ever lives in your `.env`.

### 4. Postgres connection string

> `Postgres connection string (URI, direct or pooler)`

**Where:** Supabase dashboard → click the **Connect** button at the top of the page → **Connection String** tab
**Direct link:** [supabase.com/dashboard/project/_/settings/database](https://supabase.com/dashboard/project/_/settings/database)

Copy the **URI** — it looks like `postgresql://postgres:[YOUR-PASSWORD]@db.abcdefgh.supabase.co:5432/postgres`. Replace `[YOUR-PASSWORD]` with the database password you set when you created the project.

> **Forgot your database password?** Reset it on the same page ([Settings → Database](https://supabase.com/dashboard/project/_/settings/database)) — it takes 10 seconds and doesn't break anything.
>
> Either the **direct** connection or the **session pooler** URI works. If you're on a network without IPv6 (most home networks), use the **session pooler** one.

That's it. The installer generates your `CRON_SECRET` itself, applies all database migrations, and writes `.env`. When it finishes:

```bash
npm run dev
```

---

## First boot: connect Instagram

Open [http://localhost:3000](http://localhost:3000):

1. **Register an account** — this is your login for your own MegaChat, stored in your own Supabase. No account with us, ever.
2. **Get your Zernio API key** — log in at [zernio.com](https://zernio.com), open the dashboard, and copy your API key.
3. **Paste it in Settings** — in MegaChat, go to **Settings** and paste the Zernio key.
4. **Connect Instagram** — go to **Channels** → connect Instagram. It's a normal OAuth screen, ~30 seconds.
5. **Build your first flow** — go to **Flows**, add a comment-to-DM trigger with your keyword, and publish.

Comment your keyword on one of your own posts to test it.

### Optional: AI replies

The AI Response flow node is bring-your-own-key. Create a key at [vercel.com/ai-gateway](https://vercel.com/ai-gateway) (routes to OpenAI / Anthropic / Google) and paste it into **Settings → AI key**. Skip this entirely if you don't use AI nodes.

---

## One instance, one owner

Your deployment is public on the internet. Without a gate, anyone who found your URL could register on it and use it as their own — your Supabase, your Zernio quota, your DMs. So by default, this instance is **single-tenant**: the first account you register becomes the owner, and the database blocks every signup after that (email and GitHub OAuth both).

You don't need to configure anything for this — it's on from the moment you run the installer. The `/register` page just redirects to `/login` once an owner exists.

Adding a teammate later? Open signups temporarily in the Supabase SQL editor:

```sql
update instance_config set allow_signups = true;
```

Have them register, then close it back up:

```sql
update instance_config set allow_signups = false;
```

---

## Deploy to Vercel (so it runs while your laptop is closed)

Running locally is fine for testing, but comment-to-DM needs to be online 24/7. Vercel's free Hobby plan handles it:

1. Push your clone to your own GitHub repository (or use the **Deploy with Vercel** button in the [README](README.md)).
2. When Vercel asks for environment variables, copy the values from the `.env` file the installer wrote: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`.
3. After the first deploy, set `NEXT_PUBLIC_APP_URL` to your Vercel URL (e.g. `https://your-app.vercel.app`) and redeploy.

> **Note on the migrations:** the deploy button sets env vars but can't run database migrations — run `npm run setup` locally once first (you already did if you followed this page top to bottom).
>
> **Note on the cron:** flow **Delay** steps are fired by a scheduler cron. On Vercel's free Hobby plan, crons run once a day — instant replies and comment-to-DM work perfectly either way; only long Delay steps get batched. Every-minute delays need Vercel Pro.

### Optional: encrypt your API keys

By default your Zernio and AI Gateway keys are stored as plaintext in your own Supabase project — normal for a self-host, since it's your database. If you'd rather they sit encrypted at rest, set an `ENCRYPTION_KEY` env var before you save any keys in Settings:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Paste the output in as `ENCRYPTION_KEY` and redeploy (or restart `npm run dev`). Keep that same value forever — if you change or lose it, MegaChat can no longer decrypt the keys you already saved, and you'll need to re-enter them in Settings.

---

## Troubleshooting

- **The installer rejects my key** — it validates formats before writing anything. Supabase keys are either long JWTs (start with `eyJ`) or new-style `sb_publishable_...` / `sb_secret_...` keys. Make sure you copied the whole thing.
- **"Run directly in a terminal"** — the installer needs a real interactive terminal; it won't accept piped input.
- **Want to check before committing?** `node scripts/setup.mjs --dry-run` validates your inputs and lists the migrations without touching your database.
- **Migrations mention broadcasts / WhatsApp?** Expected — the schema is kept identical to upstream [ZernFlow](https://github.com/zernio-dev/zernflow) so fixes merge cleanly. Unused tables sit empty and cost nothing.

Stuck anywhere else? Open an issue on the repo.
