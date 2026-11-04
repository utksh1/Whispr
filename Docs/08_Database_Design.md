# Whispr — Database and Data Retention Design

> **Status:** This is the future schema direction for the **existing Whispr deployment**. These target tables are **not** present as-is. Do not deploy as a replacement migration until explicit compatibility and rollback plans exist.

## Current persisted data

- `/app` uses Supabase Auth, PostgreSQL and Realtime for profiles, historical public keys, encrypted keyring backup rows and **permanent server-side encrypted `messages`**.
- `/demo` uses Express repository adapters; its PostgreSQL shape is separate and not automatically compatible with the Supabase migrations.
- Current tracked SQL under `server/supabase/migrations/` and the `client/src/lib/supabase-chat.js` queries diverge (including some profile, key and message columns). There is no committed canonical `supabase/whispr_schema.sql` at the path older docs referenced.

**Before altering production data:** inventory the **legacy Supabase** DB schema and export/backup ciphertext; verify old key recovery and reconcile migrations in an isolated test database. The **target Whispr-controlled PostgreSQL (cloud-managed or self-operated)** has a separate, versioned schema with local account IDs mapped to verified OIDC subjects. Never execute a legacy Supabase schema as the target's production schema.

## Target: server-owned operational state

| Logical table | Representative columns | Purpose and retention |
| --- | --- | --- |
| `accounts` | `account_id` UUID, state, timestamps | **Whispr-owned account identity**, not a password database |
| `account_identities` | `account_id`, trusted OIDC `issuer`, `subject`, linked time | Verified mapping from self-hosted identity provider, unique `(issuer,subject)` |
| `public_profiles` | `account_id`, opt-in handle, public display fields | Minimal discoverability; exclude email/private flags |
| `devices` | `device_id`, `account_id`, identity key, state, timestamps | Registered devices and explicit revocation |
| `identity_key_events` | `device_id`, signed binding, prior fingerprint, version | Key changes and verification audit |
| `prekey_bundles` | `device_id`, signed prekey metadata, one-time prekey reference | Asynchronous session initiation; rotate/replenish |
| `pending_envelopes` | composite (`recipient_device_id`, `envelope_id`), ciphertext, protocol version, `expires_at`, `created_at` | **Pending ciphertext only**; delete on durable device ACK or expiry |
| `delivery_keys` | composite (`recipient_device_id`, `envelope_id`), sender device, status, bounded retention | **Small idempotency/ACK tombstones** retained briefly after ciphertext deletion |
| `mailbox_events` | event ID, destination device, publication/attempt state | **Transactional notification outbox** in same acceptance transaction; bounded cleanup |
| `media_objects` | opaque ID, owner, ciphertext size, expiry, lifecycle status | Encrypted object references only; TTL cleanup |
| `encrypted_backups` | owner/device, backup version, ciphertext pointer, salt/KDF params, timestamp | **Opt-in**, opaque E2EE recovery; independent secret |

The target is **Whispr-owned PostgreSQL schema accessed through Whispr controllers**, hosted on a private cloud-managed PostgreSQL service or self-operated instance. Login is handled by a self-hosted OIDC provider; Whispr's DB never stores IdP password hashes/OAuth secrets. Explicit account/device authorization and participant/destination checks are necessary for **every** queue and media operation. Server-generated schema must never depend on recipient usernames being trustworthy identity proofs. Use least-privilege DB roles; RLS is optional defense-in-depth, not a replacement for controller authorization.

## Target: endpoint-owned data

Use IndexedDB for browser-side structured records; evaluate OPFS for large local ciphertext media. Evaluate encrypted SQLite for signed native clients.

```text
ClientLocalStore
├── conversations         # local UI + participant mappings
├── messages              # protected message content + timestamps
├── delivery_outbox       # durable ciphertext envelopes and retries
├── receipt_state         # per-recipient/device state
├── crypto_session_state  # ratchet/prekey state, protected
├── device_directory      # pinned identity fingerprints / warnings
├── attachments           # local encrypted objects and manifests
├── mailbox_sweep_state    # per-sweep pagination cursor; restart on reconnect
└── backup_metadata       # local backup status and recovery state
```

Security rate-limit counters belong in an appropriately isolated ephemeral store where possible (or a deliberately designed conservative backend fallback), not in a high-write relational table by default. They must not be evicted by normal metadata cache pressure.

A browser database is **not automatically encrypted at rest**. Define a separate local-at-rest encryption layer and protected key management, test storage eviction and report recovery limitations honestly. Ideally write crypto-state transitions, outbox/inbox records, and deduplication markers atomically.

## Delivery queue constraints

- One envelope per destination device, or equivalent recipient-scoped capability, with strict per-device authorization.
- Stable client-generated IDs and server uniqueness constraints for idempotent retries. Use a **compact `delivery_keys` ledger** so ACK/expiry deletes the large payload from `pending_envelopes` while retaining a small terminal idempotency record for the sender retry horizon.
- Expiry timestamp and garbage collection; a maximum TTL is a **configurable design decision**, not an implemented constant.
- ACK means receiver **durably persisted** the envelope/message. Reconnect and duplicates must not rollback ratchet state.
- Separate delivery receipt from human read receipt; read receipt is opt-in and E2EE where supported.
- No permanent `messages` server table in the **target** steady state. Temporary encrypted queues and backup ciphertext are permitted by their explicit policies.

## Render PostgreSQL deployment profile (TARGET)

The preferred initial production database is **paid Render PostgreSQL**, not Supabase or an in-process/ephemeral Render web-service filesystem. Whispr owns the schema for account/OIDC mappings, device/public key directory, pending ciphertext, a bounded dedup/ACK ledger and notification outbox; the API/service layer authorizes every request. Validate the paid DB's backup/restore policy, private network connection, role grants and per-device indexes.

**Media metadata must not make an object store mandatory for text-only delivery.** The `media_objects` schema and R2-backed adapter can remain unprovisioned/disabled until encrypted attachments are implemented. Then store only opaque object references and bytes/retention metadata in PostgreSQL; place ciphertext file bytes in **private Cloudflare R2** (or a reviewed interchangeable adapter). Do not use AWS S3 or Render disk as a hard dependency.

See [Vercel + Render + Optional R2](./17_Render_Vercel_R2_Deployment.md).

## Encrypted media object rules

Store only ciphertext chunks and minimal opaque manifest metadata server-side. Require authenticated upload/download capability, quotas, max object size, an expiry worker, deletion state, anti-abuse controls and safe download responses. File type/name and decryption key should travel in the encrypted chat manifest, not exposed object metadata.

## Physical mailbox scaling and cache relationships (target)

The `pending_envelopes` mailbox table should index **recipient device plus stable per-sweep pagination cursor** (e.g. `recipient_device_id, created_at, envelope_id`), and separately support `expires_at` expiration scans. Use bounded keyset pagination rather than broad `OFFSET` scans. **Do not use the timestamp as a permanent mailbox catch-up watermark:** concurrent inserts can commit out of timestamp order. Start fresh pending-mailbox scans on reconnect and periodically, with client deduplication. Enforce idempotency through the `delivery_keys` composite PK and retain only narrow terminal records for the bounded retry window.

A `mailbox_events` transactional server outbox records pending wake-up events **in the same PostgreSQL transaction** as the new `delivery_keys` and `pending_envelopes` rows. Independent workers retry notification publication. This avoids message-loss semantics when Redis Pub/Sub or a realtime gateway is unavailable. ACK atomically marks the small ledger entry delivered and removes ciphertext; expiry does the analogous terminal transition.

Use bounded expiry batch deletes first; adopt time/hash partitioning only once measurements justify it. A time partition **cannot** be dropped while any contained item must remain retrievable. Plan idempotency uniqueness carefully because PostgreSQL partitioned uniqueness rules constrain partition keys. Use authoritative primary writes for queue acceptance, ACKs and revocations; do not make lagged replicas or cached authorization decisions the final authority.

### Cache state (not message storage)

Redis is an **optional** performance/coordination dependency; approved data includes minimal public profile display fields, signed/versioned **public** key bundles, ephemeral presence, gateway routing and short-lived abuse counters. Never cache plaintext messages, recovery secrets, private keys, token material, or private email directory fields. Rate-limit keys require isolation from ordinary cache eviction.

Suggested starting TTLs **to validate**, not implemented: public profile 5–15 minutes; signed public device bundles 30–120 seconds; presence/gateway heartbeats 45–90 seconds. Revocation/identity checks must remain authoritative or version-pinned; TTL expiry alone is insufficient protection against stale keys. On Redis loss, mailbox data remains in PostgreSQL, presence becomes unknown, and recipient fetch catches up after reconnect.

Media ciphertext remains in private object storage, not Redis. CDN caching is optional and must use scoped authorization/cache keys, short-lived bearer capabilities and explicit deletion/purge policy.

See [Optimized Database Design](./14_Optimized_Database_Design.md) for an illustrative physical schema, dedup/ACK races, index choices, and per-sweep cursor semantics. See [Scalability and Caching](./13_Scalability_and_Caching.md) for retention, failure behavior and throughput assumptions.

## Self-hosted schema ownership

The target schema is designed independently from Supabase's `auth.users`, PostgREST and browser RLS access, and can run on private cloud-managed PostgreSQL without changing its ownership or security boundaries. Use stable `accounts.account_id` UUIDs, verified `(issuer,subject)` in `account_identities`, and foreign keys from devices and other metadata to local account IDs. Store no plaintext messages, IdP password hashes, OAuth refresh tokens or private encryption keys in this database. `server/supabase/migrations/` is **legacy evidence** to preserve until the source data is retired; new DDL belongs in versioned `server/migrations/` after review and test.

See [Self-Hosted Backend and Supabase Exit](./15_Self_Hosted_Backend_and_Supabase_Exit.md), [Optimized Database Design](./14_Optimized_Database_Design.md) and [Legacy Supabase Exit](./10_Supabase_Setup.md).

## Cloud database hosting (TARGET)

Managed PostgreSQL (for example AWS RDS or GCP Cloud SQL) is acceptable and preferable when it reduces operational risk. The Whispr backend owns schema migrations and per-device authorization, while the provider operates the database host, routine maintenance and selected backup facilities. Keep DB access private (no browser connections), scoped credentials and encrypted backups. Validate point-in-time restore, availability objectives, schema migration rollback, network isolation and regional data needs. If an IdP uses PostgreSQL, isolate its schema/role or database from the Whispr mailbox.

This design does **not** require self-operated database hardware and does **not** bring Supabase's Auth/PostgREST/Realtime back. See [Cloud Hosting and Deployment](./16_Cloud_Hosting_and_Deployment.md).

## Migration from existing Whispr storage

1. Freeze the current **legacy Supabase** contract; inventory and export the actual tables/RLS and encrypted backups from the authorized deployment.
2. Provision a **separate private PostgreSQL database (cloud-managed or self-operated)** with stable local accounts/verified OIDC mappings, device/prekey directory, delivery ledger, pending ciphertext and transactional outbox; do not drop legacy `messages`.
3. Verify account linking from Supabase Auth to the new self-hosted OIDC provider (never email-only), and restore old password-derived encrypted key backups **before** changing login credentials. Clients then decrypt/persist legacy history locally.
4. Verify record counts, message decryptability, local backup/recovery and multi-device policy.
5. Switch **new** messages to the Whispr-controlled pending mailbox protocol behind a feature flag; new clients call backend controllers, not Supabase tables.
6. After explicit user-facing migration/retention and tested rollback, stop legacy writes; decommission Supabase connectors/keys and delete old archives only after verified recovery and authorized retention requirements.
7. Run RLS-negative tests before rollout. Do not expose user emails as generally readable public profile columns.

See [API contracts](./09_API_Design.md), [Self-Hosted Backend and Supabase Exit](./15_Self_Hosted_Backend_and_Supabase_Exit.md) and [Legacy Supabase Setup](./10_Supabase_Setup.md).
