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

## Migration from existing Whispr storage

1. Freeze the current schema contract and inventory tables/RLS against running deployment.
2. Add new schema **alongside** legacy tables; never drop current `messages` during initial rollout.
3. Let authenticated clients paginate and decrypt old records on-device, verify integrity and write protected local copies.
4. Verify record counts, message decryptability, local backup/recovery and multi-device policy.
5. Switch **new** messages to the pending mailbox protocol behind a compatibility flag.
6. After explicit user-facing migration/retention policy, stop legacy writes; delete old server archives only when recovery/rollback requirements are satisfied.
7. Run RLS-negative tests before rollout. Do not expose user emails as generally readable public profile columns.

See [API contracts](./09_API_Design.md) and [Supabase setup](./10_Supabase_Setup.md).
