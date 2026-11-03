# Whispr — Database and Data Retention Design

> **Status:** This is the future schema direction for the **existing Whispr deployment**. These target tables are **not** present as-is. Do not deploy as a replacement migration until explicit compatibility and rollback plans exist.

## Current persisted data

- `/app` uses Supabase Auth, PostgreSQL and Realtime for profiles, historical public keys, encrypted keyring backup rows and **permanent server-side encrypted `messages`**.
- `/demo` uses Express repository adapters; its PostgreSQL shape is separate and not automatically compatible with the Supabase migrations.
- Current tracked SQL under `server/supabase/migrations/` and the `client/src/lib/supabase-chat.js` queries diverge (including some profile, key and message columns). There is no committed canonical `supabase/whispr_schema.sql` at the path older docs referenced.

**Before altering production data:** inventory actual DB schema, reconcile/apply migrations in a fresh test database, verify RLS and export/backup historical ciphertext.

## Target: server-owned operational state

| Logical table | Representative columns | Purpose and retention |
| --- | --- | --- |
| `accounts` / Supabase `auth.users` | `id`, account state | Authentication and account lifetime |
| `public_profiles` | `account_id`, opt-in handle, public display fields | Minimal discoverability; exclude email/private flags |
| `devices` | `device_id`, `account_id`, identity key, state, timestamps | Registered devices and explicit revocation |
| `identity_key_events` | `device_id`, signed binding, prior fingerprint, version | Key changes and verification audit |
| `prekey_bundles` | `device_id`, signed prekey metadata, one-time prekey reference | Asynchronous session initiation; rotate/replenish |
| `delivery_envelopes` | `envelope_id`, `recipient_device_id`, `sender_device_id`, ciphertext, protocol version, `expires_at`, `created_at` | **Pending only**, deletion on durable device ACK or expiry |
| `delivery_acks` | envelope/device key, acknowledged timestamp | Idempotency; short bounded retention |
| `media_objects` | opaque ID, owner, ciphertext size, expiry, lifecycle status | Encrypted object references only; TTL cleanup |
| `encrypted_backups` | owner/device, backup version, ciphertext pointer, salt/KDF params, timestamp | **Opt-in**, opaque E2EE recovery; independent secret |
| `rate_limit_state` | account/device/IP bucket, count, expiration | Abuse controls, minimum logging |

Explicit account/device authorization and participant/destination checks are necessary for **every** queue and media operation. Server-generated schema must never depend on recipient usernames being trustworthy identity proofs.

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
├── sync_checkpoints      # replay-safe mailbox cursor
└── backup_metadata       # local backup status and recovery state
```

A browser database is **not automatically encrypted at rest**. Define a separate local-at-rest encryption layer and protected key management, test storage eviction and report recovery limitations honestly. Ideally write crypto-state transitions, outbox/inbox records, and deduplication markers atomically.

## Delivery queue constraints

- One envelope per destination device, or equivalent recipient-scoped capability, with strict per-device authorization.
- Stable client-generated IDs and server uniqueness constraints for idempotent retries.
- Expiry timestamp and garbage collection; a maximum TTL is a **configurable design decision**, not an implemented constant.
- ACK means receiver **durably persisted** the envelope/message. Reconnect and duplicates must not rollback ratchet state.
- Separate delivery receipt from human read receipt; read receipt is opt-in and E2EE where supported.
- No permanent `messages` server table in the **target** steady state. Temporary encrypted queues and backup ciphertext are permitted by their explicit policies.

## Encrypted media object rules

Store only ciphertext chunks and minimal opaque manifest metadata server-side. Require authenticated upload/download capability, quotas, max object size, an expiry worker, deletion state, anti-abuse controls and safe download responses. File type/name and decryption key should travel in the encrypted chat manifest, not exposed object metadata.

## Physical mailbox scaling and cache relationships (target)

The mailbox table should index **recipient device plus stable pagination cursor** (e.g. `recipient_device_id, created_at, envelope_id`), and separately support `expires_at` expiration scans. Implement keyset pagination instead of offset scanning. Enforce scoped idempotent envelope uniqueness; preserve tombstones/ACK records only for the bounded retry window.

A transactional server outbox records pending wake-up events **in the same PostgreSQL transaction** as the accepted envelope. An independent worker retries notification publication. This avoids message-loss semantics when Redis Pub/Sub or a realtime gateway is unavailable.

Use bounded expiry batch deletes first; adopt time/hash partitioning only once measurements justify it. A time partition **cannot** be dropped while any contained item must remain retrievable. Plan idempotency uniqueness carefully because PostgreSQL partitioned uniqueness rules constrain partition keys. Use authoritative primary writes for queue acceptance, ACKs and revocations; do not make lagged replicas or cached authorization decisions the final authority.

### Cache state (not message storage)

Redis is an **optional** performance/coordination dependency; approved data includes minimal public profile display fields, signed/versioned **public** key bundles, ephemeral presence, gateway routing and short-lived abuse counters. Never cache plaintext messages, recovery secrets, private keys, token material, or private email directory fields. Rate-limit keys require isolation from ordinary cache eviction.

Suggested starting TTLs **to validate**, not implemented: public profile 5–15 minutes; signed public device bundles 30–120 seconds; presence/gateway heartbeats 45–90 seconds. Revocation/identity checks must remain authoritative or version-pinned; TTL expiry alone is insufficient protection against stale keys. On Redis loss, mailbox data remains in PostgreSQL, presence becomes unknown, and recipient fetch catches up after reconnect.

Media ciphertext remains in private object storage, not Redis. CDN caching is optional and must use scoped authorization/cache keys, short-lived bearer capabilities and explicit deletion/purge policy.

See [Scalability and Caching](./13_Scalability_and_Caching.md) for indexes, retention, failure behavior and throughput assumptions.

## Migration from existing Whispr storage

1. Freeze the current schema contract and inventory tables/RLS against running deployment.
2. Add new schema **alongside** legacy tables; never drop current `messages` during initial rollout.
3. Let authenticated clients paginate and decrypt old records on-device, verify integrity and write protected local copies.
4. Verify record counts, message decryptability, local backup/recovery and multi-device policy.
5. Switch **new** messages to the pending mailbox protocol behind a compatibility flag.
6. After explicit user-facing migration/retention policy, stop legacy writes; delete old server archives only when recovery/rollback requirements are satisfied.
7. Run RLS-negative tests before rollout. Do not expose user emails as generally readable public profile columns.

See [API contracts](./09_API_Design.md) and [Supabase setup](./10_Supabase_Setup.md).
