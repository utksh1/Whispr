# Whispr — Supabase Setup and Schema Migration

> **Status:** Setup for the **current** `/app` implementation, plus a clearly labeled **target** migration plan. The local-first architecture has **not** been deployed. These instructions remain part of the existing Whispr repo.

## Current product integration

`/app` uses Supabase **Auth**, browser-direct **Postgres** reads/writes, and **Realtime** updates. The server currently retains encrypted `messages` rows; device-local permanent history and pending mailboxes are planned.

The standalone Express/Socket.IO `/demo` path has separate authentication and storage contracts. Do not assume its JWT or schema is interchangeable with Supabase.

## Environment

Create `client/.env.local` (there is currently **no tracked `client/.env.example`**):

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
NEXT_PUBLIC_SUPABASE_PROJECT_REF=your_project_ref
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Only `NEXT_PUBLIC_*` variables belong in the browser bundle. For server-only privileged operations, use **server-only environment variables** and never expose service-role keys to the browser or logs.

The older docs' absolute workstation links to `/Users/Utkarsh/.../supabase/whispr_schema.sql` and `supabase/mcp_config.example.json` are **not valid committed repository paths**. Do not rely on them.

## Authentication setup

1. Configure site URL `http://localhost:3000` and exact deployed origin(s) in Supabase Auth.
2. Add the callback `/app` where needed for Google OAuth.
3. Enable email/password and, if required, Google provider. In production, use verified email confirmation and properly configured outbound email. Avoid disabling confirmation outside isolated local testing.
4. Account login currently feeds the same password into the legacy encrypted private-key backup workflow. **This is a security issue to remove**, not a recommended configuration.
5. Google OAuth on a fresh device does not provide a separate recovery-secret prompt today, so old keyring backups may be inaccessible.

## Current SQL migration source

The SQL actually tracked in this repo is at:

- [Initial Supabase schema](../server/supabase/migrations/20260418071552_initial_schema.sql)
- [OAuth trigger update](../server/supabase/migrations/20260418071857_update_auth_trigger_for_oauth.sql)
- [Client schema alignment attempt](../server/supabase/migrations/20260418071940_align_schema_with_client.sql)
- [Profile insert RLS](../server/supabase/migrations/20260418072623_add_profiles_insert_policy.sql)
- [OAuth username collision handling](../server/supabase/migrations/20260418110000_fix_oauth_user_trigger_username_collisions.sql)
- [Participant delete policy](../server/supabase/migrations/20260418113000_allow_participants_delete_conversations.sql)

**Known blocker:** the committed SQL migrations do not fully recreate the shape expected by `client/src/lib/supabase-chat.js` (including key IDs, profile fields and message receiver columns). Some legacy migrations retain incompatible non-null constraints. A new Supabase project created only from tracked SQL may not be usable. Do **not** paste ad hoc SQL from an untracked file or apply destructive corrections to live data.

## Required schema validation before any redesign migration

1. Export schema and RLS policies from the **running** Supabase project (with authorized access).
2. Diff against the six tracked migrations and current client queries.
3. Generate ordered, idempotent migration files in the repo; preserve legacy rows.
4. Replay migrations against a fresh isolated test project and run real RLS-negative tests as two users plus a nonparticipant.
5. Verify `profiles` does not expose private email data through public SELECT policy; restrict service-role access to server-only code.
6. Run auth, ciphertext roundtrip and backup recovery tests; record baseline before introducing the new mailbox model.

## Target transition (NOT IMPLEMENTED)

- Introduce `devices`, verified public key bundles, `delivery_envelopes`, idempotent ACKs, limited delivery receipts, `media_objects` and optional encrypted backup metadata alongside the legacy tables.
- Switch `/app` to encrypted local conversation history and a **pending-only per-device mailbox** using versioned APIs; use Realtime as wake-up hint, not the source of durable history.
- Use private object storage for **client-encrypted** attachments only; never hand object storage the file keys or plaintext previews.
- Import old history to local encrypted storage on each device before retiring legacy `messages`; never discard users' ciphertext on a speculative schema rollout.
- Replace password-derived backup recovery with an independent secret and explicit restore UX.

See [Data Design](./08_Database_Design.md), [API Design](./09_API_Design.md), [Roadmap](./10_Development_Roadmap.md).

## Scalability and caching deployment considerations (TARGET)

The proposed mailbox is **not** yet a tracked Supabase table. Before adding an optional Redis cache, implement authenticated device-scoped PostgreSQL envelope/ACK contracts, RLS, a transactional notification outbox, keyset indexes and bounded expiry workers. Avoid caching sensitive Supabase auth or service-role material.

When gateway replicas require cross-instance coordination, Redis may hold ephemeral presence and wake-up routing. If Redis is unavailable, **authorized PostgreSQL mailbox polling/fetch must still work**. Redis Pub/Sub is not a durable queue; do not make RLS/authorization depend on cache presence.

Encrypted media can use a private storage bucket and authorized short-lived transfer URLs; the object store/CDN sees ciphertext bytes only. CDN cache keys must not authorize access across accounts. Plan orphan-upload and expiry cleanup separately from mailbox retention.

Supabase Realtime quotas, database connection pools, migration consistency and available RLS policies must be verified against the actual deployed plan before scaling. Cache TTLs and performance goals are proposed in [Scalability and Caching](./13_Scalability_and_Caching.md), not deployed settings.

## Optimized database migration target (PLANNED, NOT APPLIED)

The proposed physical mailbox separates **`delivery_keys` status/idempotency**, **`pending_envelopes` encrypted payload only** and **`mailbox_events` durable notification intent**, plus registered devices/prekeys and minimal media metadata. Do not add or remove tables in the live Supabase project until the six tracked migrations and current client queries have been reconciled.

Treat browser-direct access differently from server-only queue APIs: service-role bypasses ordinary RLS, so backend device/account authorization is mandatory. The target also requires narrow indexes for per-device inbox and expiry, safe deleted-payload dedup tombstones, and periodic rescan (a timestamp keyset cursor is not a commit-order watermark).

See [Optimized Database Design](./14_Optimized_Database_Design.md) for **illustrative, unexecuted** SQL and additive migration/recovery gates.

## Demo-only and privileged tooling

The Next.js `/api/admin` route can operate with a Supabase service-role client and currently lacks user authorization checks; `ENABLE_DEMO_ADMIN` must never be enabled in a public production deployment. Remove/isolate this path as part of the security work. The Express demo tamper route is likewise not a production capability.

## MCP / developer tooling

Supabase MCP may be configured through the official service with project-scoped authorization. Example clients can use `https://mcp.supabase.com/mcp?project_ref=YOUR_PROJECT_REF` and request only needed capabilities. Treat MCP access as privileged; use short-lived credentials and never commit access tokens, secret keys or personal machine paths.
