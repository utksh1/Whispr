# Whispr — Supabase Setup

Whispr's product app (`/app`) now uses Supabase Auth, Postgres, and Realtime from the browser.

## Project Env

```env
NEXT_PUBLIC_SUPABASE_URL=https://lptfbgohubujthjnerwm.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
NEXT_PUBLIC_SUPABASE_PROJECT_REF=lptfbgohubujthjnerwm
SUPABASE_SECRET_KEY=your_secret_key
```

Only `NEXT_PUBLIC_*` values belong in the browser bundle.

Never expose `SUPABASE_SECRET_KEY` to the client.

## Required Supabase Auth Settings

### 1. Site URL and Redirect URLs

In Supabase Auth settings, allow these frontend URLs:
- `http://localhost:3000`
- `https://whispr-client-utksh1.vercel.app`

For Google OAuth, also allow:
- `http://localhost:3000/app`
- `https://whispr-client-utksh1.vercel.app/app`

If you use a preview deployment or custom domain, add that exact origin and `/app` callback too.

### 2. Email/Password Auth

Enable email/password sign-in in Supabase Auth if you want the built-in register/login form to work.

For local demos, turn off email confirmation:
- Supabase Dashboard → Authentication → Sign In / Providers → Email
- Disable `Confirm email`
- Save changes

Why: Supabase's built-in email sender is intentionally limited. If confirmation emails are enabled and you create several test users, signup can fail with `Email rate limit exceeded` / `over_email_send_rate_limit`. For production, keep email confirmation on and configure custom SMTP under Authentication email settings, then adjust Auth rate limits in Authentication → Rate Limits.

### 3. Google OAuth

Enable the Google provider in Supabase Auth and configure the Google Cloud OAuth credentials there.

Product note:
- Google sign-in creates the Supabase session.
- Whispr still encrypts the private-key backup with a user password-derived secret.
- So Google sign-in alone does not restore an old encrypted key backup on a brand-new device unless a backup-passphrase restore flow is added later.

## Required Database Schema

Run the SQL in:
- [supabase/whispr_schema.sql](/Users/Utkarsh/Desktop/Projects/Whispr/supabase/whispr_schema.sql)

This creates:
- `profiles`
- `user_keys`
- `private_key_backups`
- `messages`

It also enables:
- Row Level Security
- ownership policies for writes
- participant-only message reads
- Realtime publication for `messages`

## Current Product Tables

### `profiles`

Purpose: user discovery and active public key lookup.

Stores:
- auth user id
- username
- current public key
- active key id
- backup presence flag

### `user_keys`

Purpose: historical public keys by deterministic key id.

Stores:
- key id
- owner user id
- public key
- active/revoked status

### `private_key_backups`

Purpose: encrypted keyring backup material only.

Stores:
- ciphertext
- salt
- iv
- version

Plaintext private keys must never be stored.

### `messages`

Purpose: ciphertext-only message storage and realtime sync.

Stores:
- sender and receiver ids
- sender and receiver key ids
- ciphertext
- nonce
- salt
- version
- timestamps

## Supabase MCP

Whispr can use Supabase's MCP server for docs, database work, debugging, functions, storage, and branching-aware tooling.

Example config:
- [supabase/mcp_config.example.json](/Users/Utkarsh/Desktop/Projects/Whispr/supabase/mcp_config.example.json)

If you want to use the same config in Antigravity, add this to `~/.gemini/antigravity/mcp_config.json`:

```json
{
  "mcpServers": {
    "supabase": {
      "serverUrl": "https://mcp.supabase.com/mcp?project_ref=lptfbgohubujthjnerwm&features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions%2Cbranching%2Cstorage"
    }
  }
}
```

After saving the config, restart the MCP client and complete the Supabase OAuth flow if prompted.

Optional agent skills install:

```bash
npx skills add supabase/agent-skills
```

## Current Scope

The `/app` route now uses Supabase Auth, Postgres, and Realtime directly from the browser.

The `/demo` route and Express server still remain for the hackathon explanation flow and Swagger docs.
