# Whispr — Legacy Supabase Setup and Decommissioning

> **LEGACY ONLY / MIGRATION REFERENCE.** The **existing `/app` currently depends on Supabase**, but the **target Whispr system is self-hosted and has no Supabase runtime dependency**. Keep these details solely to support current deployments, historical data export, recovery and rollback. Do not set up a new Supabase project for the future architecture. No live migration or deletion has been executed.

## What is being replaced

| Legacy Supabase area | Current role | Whispr target |
| --- | --- | --- |
| Supabase Auth | `/app` email/password, Google OAuth and sessions | A **self-hosted, reviewed OIDC identity provider** (evaluate Keycloak or equivalent); Whispr Auth Controller verifies issuer/audience/JWKS and maps verified identities to local accounts |
| PostgREST / browser-direct data | Browser reads/writes `profiles`, `user_keys`, `messages` and `private_key_backups` | Authenticated Whispr controllers and private Whispr-controlled PostgreSQL (cloud-managed or self-operated); no direct browser database access |
| Supabase Realtime | Browser subscriptions on message rows | Whispr-managed Socket.IO/WebSocket wake-up hints + durable mailbox fetch |
| Supabase Postgres | Auth-linked profiles, ciphertext-only permanent server history, keyring backups | Whispr accounts/device/prekey directory, **pending ciphertext only**, small dedup ledger and transactional notification outbox |
| Supabase Storage (future option) | No complete media pipeline established in current product | Private cloud object storage (or S3-compatible self-operated alternative), client-encrypted files and scoped short-lived capabilities |

See [Self-Hosted Backend and Supabase Exit](./15_Self_Hosted_Backend_and_Supabase_Exit.md) and [Tech Stack](./07_Tech_Stack.md).

## Legacy client configuration — for maintaining/migrating existing `/app` only

The current client expects `client/.env.local` containing public Supabase configuration. These variables are **legacy** and are not part of the target client:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_EXISTING_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=existing_publishable_key
NEXT_PUBLIC_SUPABASE_PROJECT_REF=existing_project_ref
NEXT_PUBLIC_API_URL=http://localhost:4000
```

The current repo does not track `client/.env.example`. Only `NEXT_PUBLIC_*` values are publicly bundled. Never expose a service-role key or secret in the browser, source control, screenshots, demo tools, or migration logs.

The old documentation's absolute machine-specific links to `/Users/Utkarsh/.../supabase/whispr_schema.sql` and `supabase/mcp_config.example.json` do **not** point to committed repository files. Use only reviewed tracked migrations as references.

## Historical Auth configuration (do not use as new-system guide)

The existing product may require historical Supabase redirect URLs for local `http://localhost:3000` and `/app` OAuth callback; keep them working only until controlled cutover. If email confirmation or Google OAuth is involved in old-account recovery, use the real existing project and protect users from phishing/social account takeover. Do not disable production email verification to simplify migration.

**Critical backup issue:** the current client derives its encrypted keyring backup key from the login password. New OIDC login credentials or OAuth identity linking do **not** automatically unlock old private keys. An explicit old-secret recovery and encrypted-backup rekey flow must be tested **before** legacy authentication is retired. Never silently replace a failed-to-decrypt backup.

## Actual committed legacy SQL

These are the tracked migration files (the target self-hosted schema will live separately under `server/migrations/`):

- [Initial schema](../server/supabase/migrations/20260418071552_initial_schema.sql)
- [OAuth trigger update](../server/supabase/migrations/20260418071857_update_auth_trigger_for_oauth.sql)
- [Client alignment attempt](../server/supabase/migrations/20260418071940_align_schema_with_client.sql)
- [Profile insert RLS](../server/supabase/migrations/20260418072623_add_profiles_insert_policy.sql)
- [OAuth username collision handling](../server/supabase/migrations/20260418110000_fix_oauth_user_trigger_username_collisions.sql)
- [Participant delete policy](../server/supabase/migrations/20260418113000_allow_participants_delete_conversations.sql)

**Known blocker:** these files do **not** fully recreate all columns expected by `client/src/lib/supabase-chat.js`. Do not attempt a destructive or unreviewed production SQL patch. Export the authorized **actual running schema and RLS**, compare with tracked migrations, replay in a disposable isolated test database, and record user/message/backup object counts.

## Self-hosted replacement configuration (TARGET, examples only)

**Illustrative names, not implemented environment variables:** the final deployment will need separate OIDC issuer/JWKS/audience settings, an internal PostgreSQL connection secret, private object-store endpoint/credentials, and public Whispr API/WebSocket endpoints. Validate against actual code before setting these values. Secrets must remain server-only.

```dotenv
# EXAMPLE CONTRACT ONLY; not consumed by current source.
WHISPR_API_URL=https://api.example.invalid
OIDC_ISSUER=https://identity.example.invalid/realms/whispr
OIDC_AUDIENCE=whispr-api
DATABASE_URL=postgresql://...  # server-only secret
OBJECT_STORE_ENDPOINT=https://storage.example.invalid
OBJECT_STORE_BUCKET=encrypted-attachments
REDIS_URL=redis://...          # optional, internal only
```

Do **not** commit real passwords, OAuth client secrets, object-store keys or OIDC signing keys. A production backend must use HTTPS, verified TLS, private database networks, secret rotation and tested backup/restore. The selected IdP—not a home-grown auth controller—issues login tokens.

## Preferred post-Supabase hosting (TARGET)

After **verified migration**, the intended app platform is **Vercel** for `client/` and **Render** for Whispr API/Socket.IO + reviewed OIDC + **paid Render PostgreSQL**. **Cloudflare R2 is optional for encrypted media only**; a text-only launch needs no remote object storage and no AWS S3 account. Render Key Value/Redis is likewise optional for cross-gateway coordination.

Legacy Supabase credentials and storage are retained only for authorized history, identity and password-derived keyring recovery until the staged cutover succeeds; do not confuse successful provider provisioning with safe decommissioning. See [Vercel + Render + Optional R2](./17_Render_Vercel_R2_Deployment.md).

## Required non-destructive migration gates

1. **Inventory and backup:** authorized export of Supabase users, key directory, historical messages and encrypted backups; verify object counts, schema/RLS and independent restore.
2. **Provision target:** private cloud-managed or self-operated PostgreSQL, an evaluated cloud-hosted OIDC provider, private object store and Whispr-controlled API; test service connectivity and least privilege without old-user data.
3. **Identity matching:** map `(legacy Supabase identity, verified new OIDC issuer+subject)` to a stable Whispr account UUID by proof of both identities or controlled verified recovery; **never link by matching email alone**.
4. **Cryptographic recovery:** old keyring restoration and re-encryption under a *separate* recovery secret; validate on a fresh device before invalidating old login credentials.
5. **New mailbox/data flows:** create `accounts`/`account_identities`, `devices`, signed/prekeys, `delivery_keys`, `pending_envelopes`, `mailbox_events` and private encrypted media metadata in self-hosted PostgreSQL. Verify API authorization and race/expiry/replay tests.
6. **Client migration:** read legacy ciphertext through authorized old access, decrypt on device, write encrypted local history; checkpoint safely. Switch **new** sends to the Whispr mailbox after user/device verification. Avoid uncontrolled dual writes.
7. **Controlled retirement:** keep old environment read-only during a defined rollback period; audit recovery and missing-data cases; then revoke Supabase connections/keys and delete data only after authorized retention/export/recovery requirements are satisfied.

Run nonparticipant/unauthorized device tests against the **new controller layer**. The old RLS policies are part of migration risk analysis, not a substitute for backend authorization. A privileged database client can bypass RLS; there is no direct database endpoint in the target client.

## Existing demo and privileged APIs

The Express `/demo` JWT issuer remains distinct from current Supabase product Auth. Its predictable default JWT secret is a release blocker; don't reuse its login controller unchanged. The Next.js `/api/admin` privileged demo route lacks expected authentication/authorization. Remove or isolate these demo tools before public access.

## References and next actions

[Self-Hosted Backend and Supabase Exit](./15_Self_Hosted_Backend_and_Supabase_Exit.md) · [Optimized Database](./14_Optimized_Database_Design.md) · [System Architecture](./04_System_Architecture.md) · [API Contracts](./09_API_Design.md) · [Roadmap](./10_Development_Roadmap.md).

**This file is documentation for an exit path.** No production Supabase configuration, users, backups, rows or sessions have been changed.
