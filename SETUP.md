# MegaChat Setup Guide

**Total time: ~10 minutes. Total cost: $0.**

The easiest route is browser-only: deploy MegaChat, open its setup page, and paste four values from Supabase. The page links directly to every provider screen, initializes the database, generates the remaining secrets, and prepares one block to paste into Vercel.

---

## Before you start

You need three free accounts:

| What | Where | Cost |
|---|---|---|
| **A Supabase project** | [supabase.com/dashboard](https://supabase.com/dashboard) → **New project** | Free tier |
| **A Zernio account** | [zernio.com](https://zernio.com) → sign up | Free up to 2 Instagram accounts |
| **A Vercel account** | [vercel.com](https://vercel.com) → continue with GitHub | Free Hobby tier |

**Supabase** is your database — it stores your contacts, conversations, and flows. **Zernio** is the Instagram layer — it handles Meta's OAuth, tokens, and webhooks so you never touch the Meta developer console.

> **Create the Supabase project first.** It takes about two minutes to provision. Save the **database password** you choose; the final setup field needs it.

---

## Browser setup (recommended)

1. Click the [Deploy with Vercel button](README.md#megachat). Vercel asks you to sign in, creates your own Git repository copy, and deploys MegaChat.
2. Click **Visit** when the deployment finishes. Because the deployment has no Supabase values yet, MegaChat opens `/setup` automatically.
3. Keep your Supabase project open. Use the direct link beside each setup field to copy the matching value.
4. Click **Initialize database**. The Postgres URI goes only to your own MegaChat deployment, which runs the repository's fixed, idempotent migrations and does not retain the URI.
5. Click **Copy Vercel values**.
6. In Vercel, choose the new MegaChat project, then open **Settings → Environment Variables**. Paste the entire copied block, apply it to Production, Preview, and Development, and save.
7. If Vercel already has a deployment, accept its **Redeploy** prompt. If it says **No Production Deployment**, the project was connected without an initial build; import the repository with **Add New → Project** or push `main` to create that first deployment. Environment changes only take effect in a new deployment.
8. Open `/setup` on the deployed MegaChat domain. In **Allow this deployment in Supabase Auth**, copy the exact Site URL and Redirect URL.
9. In Supabase, open **Authentication → URL Configuration**. Set **Site URL** to the deployed MegaChat origin and add its `/auth/callback` as a **Redirect URL**. Keep `http://localhost:3000/auth/callback` as an additional Redirect URL only if you also develop locally.
10. Return to MegaChat and register the owner account.
8. Open MegaChat again and register the owner account.

MegaChat automatically requests Vercel's production URL for webhooks and OAuth callbacks. You do not need to add `NEXT_PUBLIC_APP_URL` unless you intentionally want to force a custom domain. Supabase still requires that callback to be added to **Authentication → URL Configuration**; the deployed `/setup` page displays the exact values.

### What the setup page does with secrets

- The publishable key, secret key, generated cron secret, and generated encryption key stay in the browser until you copy them to Vercel.
- The Postgres connection URI is sent once over HTTPS to your own deployment to install the database schema. It is not written to an environment variable, database table, log, or browser storage.
- The migration endpoint only accepts Supabase database hosts and only executes MegaChat's checked-in migration files.

---

## Local terminal setup (alternative)

Local setup requires [Node.js 18+](https://nodejs.org). Clone the repository and run:

```bash
git clone https://github.com/rodneymanor/megachat.git
cd megachat
npm install
npm run setup
```

`npm run setup` asks for the same four Supabase values, generates a cron secret, runs every migration, and writes `.env`. No SQL editor is required.

---

## The four Supabase values

The web setup page and terminal installer use the same four values.

### 1. Project URL

> `Project URL (e.g. https://abcdefgh.supabase.co)`

**Where:** Supabase dashboard → **Project Settings → Data API**
**Direct link:** [supabase.com/dashboard/project/_/settings/api](https://supabase.com/dashboard/project/_/settings/api)

Copy the **Project URL** at the top of the page. It looks like `https://abcdefgh.supabase.co`.

### 2. Publishable key (or legacy anon key)

> `anon / publishable key`

**Where:** Supabase dashboard → **Project Settings → API Keys**
**Direct link:** [supabase.com/dashboard/project/_/settings/api-keys](https://supabase.com/dashboard/project/_/settings/api-keys)

Copy the **Publishable key** (starts with `sb_publishable_`). Older projects can use the legacy **anon** key. Both are intended for browser use.

### 3. Secret key (or legacy service_role key)

> `service_role / secret key`

**Where:** Same page as #2 — [supabase.com/dashboard/project/_/settings/api-keys](https://supabase.com/dashboard/project/_/settings/api-keys)

Copy a **Secret key** (starts with `sb_secret_`). Older projects can use the legacy **service_role** key. This value is private and belongs only in Vercel or a local ignored environment file.

### 4. Postgres Session pooler URI

> `Postgres connection string (URI, direct or pooler)`

**Where:** Supabase dashboard → click the **Connect** button at the top of the page → **Connection String** tab
**Direct link:** [supabase.com/dashboard/project/_/settings/database](https://supabase.com/dashboard/project/_/settings/database)

Choose **Session pooler** on port **5432** and copy the URI. It looks like `postgresql://postgres.project:[YOUR-PASSWORD]@aws-0-region.pooler.supabase.com:5432/postgres`. Replace `[YOUR-PASSWORD]` with the database password you set when you created the project.

> **Forgot your database password?** Reset it on the same page ([Settings → Database](https://supabase.com/dashboard/project/_/settings/database)) — it takes 10 seconds and doesn't break anything.
>
> The Session pooler works over IPv4 from both Vercel and most home networks. The web setup deliberately rejects the transaction pooler on port 6543.

The local installer generates `CRON_SECRET`, applies all database migrations, and writes `.env`. When it finishes:

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

You don't need to configure anything for this — it is enabled when the database is initialized. The `/register` page redirects to `/login` once an owner exists.

Adding a teammate later? Open signups temporarily in the Supabase SQL editor:

```sql
update instance_config set allow_signups = true;
```

Have them register, then close it back up:

```sql
update instance_config set allow_signups = false;
```

---

## Upload your own MegaChat repository to Vercel

Use this path when you modified MegaChat locally and want Vercel to deploy your version. The Deploy button is easier for an unchanged copy.

### 1. Put the repository on GitHub

1. Sign in to [GitHub](https://github.com) and click **New repository**.
2. Name it `megachat`, choose **Private** or **Public**, and create it without adding a README or `.gitignore`.
3. A normal MegaChat clone already has an `origin` remote. Point it at the empty repository you just created, then push:

   ```bash
   git remote set-url origin https://github.com/YOUR-NAME/megachat.git
   git branch -M main
   git push -u origin main
   ```

   If Git says `No such remote 'origin'`, use `git remote add origin https://github.com/YOUR-NAME/megachat.git` instead. Confirm the destination is the new empty repository before pushing.

### 2. Import it into Vercel

1. Open the [Vercel dashboard](https://vercel.com/dashboard) and click **Add New → Project**.
2. Find the new `megachat` GitHub repository and click **Import**.
3. Leave the detected framework and build settings unchanged. Do not add environment variables yet.
4. Click **Deploy**. The first deployment is intentionally unconfigured and routes to `/setup`.
5. Open the deployment and complete the [browser setup](#browser-setup-recommended). After the wizard runs migrations, paste its generated block into **Settings → Environment Variables** and redeploy.
6. Reopen the deployed `/setup` page and add its displayed Site URL and `/auth/callback` to Supabase **Authentication → URL Configuration** before registering.

Every future push to `main` creates a new production deployment automatically. Pull-request branches get preview deployments when the same environment values are enabled for Preview.

> Do not create an empty Vercel project and connect Git afterward without running a first build. Vercel cannot redeploy a project that has no deployment record. If that happens, push a new commit to `main`; the connected Git repository will create the initial production deployment.

### Scheduler behavior on Vercel

Flow **Delay** steps use the cron in `vercel.json`. The repository defaults to one daily run (`0 3 * * *`) because that is the fastest schedule accepted by Vercel Hobby. Instant replies and comment-to-DM do not use this cron and remain instant.

On Vercel Pro, change the schedule to every minute and push the commit:

```json
{
  "crons": [{ "path": "/api/cron/jobs", "schedule": "* * * * *" }]
}
```

### API-key encryption

The browser setup generates `ENCRYPTION_KEY` automatically, so Zernio and AI Gateway keys are encrypted at rest from first use. If you used the local terminal installer, encryption is optional; generate a key before saving provider keys:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Paste the output in as `ENCRYPTION_KEY` and redeploy (or restart `npm run dev`). Keep that same value forever — if you change or lose it, MegaChat can no longer decrypt the keys you already saved, and you'll need to re-enter them in Settings.

---

## Troubleshooting

- **"This workspace isn't active yet" / `/locked`** — hosted billing mode was enabled on a self-hosted deployment. Open Vercel → **Settings → Environment Variables**, set `HOSTED_MODE=false` (or remove it), and redeploy. The generated self-host environment block includes the safe `false` value automatically. The workspace already exists; no database repair or second signup is needed.
- **The installer rejects my key** — it validates formats before writing anything. Supabase keys are either long JWTs (start with `eyJ`) or new-style `sb_publishable_...` / `sb_secret_...` keys. Make sure you copied the whole thing.
- **"Run directly in a terminal"** — the installer needs a real interactive terminal; it won't accept piped input.
- **Want to check before committing?** `node scripts/setup.mjs --dry-run` validates your inputs and lists the migrations without touching your database.
- **Migrations mention broadcasts / WhatsApp?** Expected — the schema is kept identical to upstream [ZernFlow](https://github.com/zernio-dev/zernflow) so fixes merge cleanly. Unused tables sit empty and cost nothing.

Stuck anywhere else? Open an issue on the repo.
