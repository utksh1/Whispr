# Whispr — Optimized Database Design and Access Patterns

> **Status: PROPOSED / NOT IMPLEMENTED.** This is the physical data-model proposal for the **existing Whispr project**, building on [Database and Data Retention Design](./08_Database_Design.md). It is **not a production migration or drop-in SQL patch**. Review the **legacy Supabase** schema and migrations, then validate the new **private Whispr PostgreSQL (cloud-managed or self-operated)**, chosen OIDC integration, tested E2EE protocol and device-identity rules before implementing.

## 1. Optimization objective

Whispr is a **delivery system**, not a permanent server-side chat database. Optimize the server for:

1. **Write once, fetch by recipient device, delete promptly** for ciphertext envelopes.
2. **Small metadata-only idempotency records** retained for a bounded retry window *after* ciphertext deletion.
3. **No per-WebSocket-attempt database writes** and no permanent server conversations/search indexes.
4. **Separate authorization, identity and object-store metadata** from hot-path envelope bytes.
5. **Reliable transactions** for envelope acceptance, notification outbox, ACK and expiry.
6. **Efficient local reads** on the client, where long-term encrypted messages are the source of truth.

Do **not** optimize merely by introducing more tables, replicas, caches, sharding or partitioning. Start with a small number of targeted indexes and measure the actual read/write/expiry workload.

## 2. Storage ownership

| Storage | Authoritative for | Not authoritative for |
| --- | --- | --- |
| Protected IndexedDB / native encrypted SQLite | Per-device conversation history, encrypted ratchet/session state, local outbox, identity pins and local attachment index | Other users' history |
| **Whispr-controlled PostgreSQL (managed cloud DB is acceptable)** | Whispr account/OIDC identity mapping, device directory, signed public prekeys, **pending** envelopes, minimal idempotency/ACK, outbox, encrypted media metadata | Permanently delivered messages, auth passwords or plaintext |
| **Private S3-compatible self-hosted object storage** | **Temporary encrypted** file chunks | File plaintext or decryption keys |
| Redis (optional) | Presence, gateway mapping, safe public metadata caches and isolated abuse counters | Pending deliveries, durable ACK state, private keys |
| CDN (optional) | Immutable public assets and **authorized ciphertext media** | Private API JSON, decrypted previews or recovery material |

No server `conversations`, `messages` or `message_metadata` table is required **in steady state** for ordinary delivered history. Existing legacy tables must stay until an explicit safe migration finishes.

## 3. Recommended core server tables

| Table | Critical fields | Retention / access |
| --- | --- | --- |
| `accounts` | stable local account UUID, status, created time | Stable internal identity; no password hashes or OAuth credentials |
| `account_identities` | local account UUID, trusted OIDC issuer, subject | Unique `(issuer,subject)` verified mapping; no email-only merges |
| `public_profiles` | account ID, opt-in handle/display fields | Long-lived, allowlisted public fields only; never include account email in public projection |
| `devices` | device ID, account ID, identity public key, created/revoked times, version | Long-lived until account/device deletion; per-device auth binding |
| `device_prekey_bundles` | device ID, key bundle ID/version, signed public bundle, expiry | Rotate/replenish; atomic one-time prekey consumption required |
| `delivery_keys` | recipient device ID, envelope ID, sender device ID, terminal/pending status, retention deadline | **Narrow idempotency ledger**, retained briefly after delivery/expiry |
| `pending_envelopes` | recipient device ID, envelope ID, protocol version, ciphertext bytes, created/expiry time | **Hot mailbox**; delete ciphertext on ACK or expiry |
| `mailbox_events` | event ID, destination device, event type, publication attempt/next-run time | Transactional wake-up outbox, bounded cleanup |
| `media_objects` | opaque object ID/key, owner, ciphertext byte count, upload state, expires time | Metadata only; bytes remain in object storage |
| `encrypted_backups` | owner ID, version, encrypted object reference/KDF params, recovery metadata | Opt-in; separate secret; explicit backup lifecycle |

Why separate `delivery_keys` and `pending_envelopes`? After the recipient ACKs, remove the relatively large encrypted payload immediately but preserve a small key/status tombstone. A sender retry using the same envelope ID during the defined retry horizon returns the terminal outcome rather than recreating a delivered envelope.

### 3.1 Representative PostgreSQL DDL (design example, not applied)

The following uses **Whispr-owned `accounts` rows** with a separate verified **self-hosted OIDC `(issuer,subject)` mapping**. This is an **illustrative target subset**: real migrations need least-privilege DB roles and controller/API authorization, verified identity/prekey protocol, media-specific DDL, account deletion rules, backfill and rollback. Passwords and OAuth secrets stay with the selected identity provider.

```sql
-- Stable account ID is independent of the OIDC provider's subject.
create table public.accounts (
  account_id uuid primary key,
  created_at timestamptz not null default now(),
  disabled_at timestamptz
);

create table public.account_identities (
  account_id uuid not null references public.accounts(account_id) on delete cascade,
  issuer text not null,
  subject text not null,
  linked_at timestamptz not null default now(),
  primary key (issuer, subject),
  check (length(issuer) > 0 and length(subject) > 0)
);

create index account_identities_by_account_idx
  on public.account_identities(account_id);

create table public.devices (
  device_id uuid primary key,
  account_id uuid not null references public.accounts(account_id) on delete cascade,
  identity_public_key bytea not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index devices_active_by_account_idx
  on public.devices (account_id, device_id)
  where revoked_at is null;

-- Tiny retained status/idempotency row. Status: 0=pending,
-- 1=delivered, 2=expired; it is NOT a human read receipt.
create table public.delivery_keys (
  recipient_device_id uuid not null references public.devices(device_id),
  envelope_id uuid not null,
  sender_device_id uuid not null references public.devices(device_id),
  status smallint not null default 0 check (status in (0, 1, 2)),
  accepted_at timestamptz not null default now(),
  changed_at timestamptz not null default now(),
  retention_until timestamptz not null,
  primary key (recipient_device_id, envelope_id)
);

-- Only still-pending encrypted payloads belong here.
create table public.pending_envelopes (
  recipient_device_id uuid not null,
  envelope_id uuid not null,
  protocol_version smallint not null check (protocol_version > 0),
  ciphertext bytea not null
    check (octet_length(ciphertext) between 1 and 65536),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (recipient_device_id, envelope_id),
  foreign key (recipient_device_id, envelope_id)
    references public.delivery_keys(recipient_device_id, envelope_id)
    on delete cascade,
  check (expires_at > created_at)
);

-- Deterministic mailbox pagination, no broad OFFSET scan.
create index pending_envelopes_inbox_idx
  on public.pending_envelopes
  (recipient_device_id, created_at, envelope_id);

-- Expiry workers scan a bounded batch of oldest expirations.
create index pending_envelopes_expiry_idx
  on public.pending_envelopes (expires_at, recipient_device_id);

-- Minimal durable intent to publish a wake-up notification.
create table public.mailbox_events (
  event_id bigint generated always as identity primary key,
  recipient_device_id uuid not null references public.devices(device_id),
  envelope_id uuid not null,
  event_kind smallint not null check (event_kind in (1, 2)),
  next_attempt_at timestamptz not null default now(),
  published_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  created_at timestamptz not null default now()
);

create index mailbox_events_ready_idx
  on public.mailbox_events (next_attempt_at, event_id)
  where published_at is null;

create index delivery_keys_terminal_cleanup_idx
  on public.delivery_keys (retention_until)
  where status in (1, 2);
```

**Not drop-in production SQL:** after protocol/role decisions, add explicit `GRANT`/`REVOKE`, scoped service accounts, optional RLS defense-in-depth, server-only queue API, media/prekey tables, cleanup policies and unit/integration tests. **The selected OIDC provider's tokens are validated by Whispr controllers; they do not directly authorize SQL.** A privileged DB connection must enforce account/device authorization in the application (RLS cannot be the only guard). Browser clients must not write these tables directly just because they know a device ID.

The envelope size cap `65536` bytes is an **example** suitable for small encrypted message envelopes; its correct value depends on the chosen protocol and envelope metadata. Large attachments belong in object storage. Enforce independently checked media sizes.

### 3.2 Enqueue transaction and idempotency

In **one PostgreSQL transaction**:

1. Authenticate the sender's active device using the session and an authoritative device lookup. Validate target device/identity and bounded expiry.
2. Insert `delivery_keys(recipient_device_id, envelope_id, sender_device_id, status=0, retention_until)` on first submission.
3. If the composite key already exists, verify the **original authenticated sender/device** and return its existing status (or a safe conflict), without inserting ciphertext or a second notification.
4. On a genuinely new key, insert one `pending_envelopes` row and one `mailbox_events` row.
5. Commit, then return `accepted`. No WebSocket/Redis success is required for acceptance.

The composite primary key is the concurrency/idempotency boundary; `ON CONFLICT DO NOTHING` alone is **not** sufficient unless the application subsequently verifies original sender and status. Never release a status about someone else's envelope.

### 3.3 Fetch and pagination

Use parameterized **recipient-device-specific** queries with strict authorization and a small bounded page:

```sql
select envelope_id, protocol_version, ciphertext, created_at, expires_at
from public.pending_envelopes
where recipient_device_id = $1
  and expires_at > statement_timestamp()
  and (created_at, envelope_id) > ($2, $3)
order by created_at, envelope_id
limit $4;
```

`$2/$3` represent the current **pagination** position for that sweep; the first page uses a separate query without the cursor predicate. The API clamps `$4` to a safe maximum.

**Critical consistency detail:** a timestamp/sequence allocated before transaction commit is **not a guaranteed commit-order watermark**. A long-running insert may commit after the client has advanced its cursor, even if the insert has an earlier timestamp. Therefore the cursor above is **not a permanent last-seen watermark**. Start fresh mailbox sweeps from the beginning on reconnect and periodically while connected, or adopt a separately designed, verified commit-order log. Deduplication on the client handles repeat results.

### 3.4 ACK, expiry and tombstone retention

For each authenticated recipient-device ACK, in a database transaction lock the `delivery_keys` row (or use equivalent compare-and-set), validate its status, transition `pending → delivered`, delete the matching `pending_envelopes` ciphertext, and retain only the small terminal ledger row until `retention_until`. Duplicate ACK is idempotent. A revoked device cannot continue fetching or ACKing newly pending envelopes by virtue of its device ID alone.

Expiry workers scan expired pending rows in bounded concurrent batches, transitioning terminal status to `expired` before deleting payload. `FOR UPDATE SKIP LOCKED` is appropriate **for workers consuming queue-like jobs**, not for normal client mailbox reads; it can skip rows. <https://www.postgresql.org/docs/current/sql-select.html>

The retention deadline for tombstones must exceed the sender's maximum allowed retry horizon and accommodate clock skew/recovery. After the deduplication row is purged, reuse of the **same** ID cannot be server-blocked by that ledger; client protocol replay protection remains mandatory. Terminal cleanup must **never** cascade-delete pending envelopes before legitimate TTL expiry.

Human read receipts, if enabled, are separate opt-in E2EE events, not a Boolean on the server queue.

## 4. Avoid write amplification and excess indexes

- Do not update SQL on every websocket attempt, heartbeat, reconnect, temporary `delivering` state, typing indicator or online presence change. Presence stays in an ephemeral store.
- Maintain only indexes justified by mailbox fetch, expiry, worker-ready selection and device lookups. Each index increases insert, WAL and delete cost.
- Keep envelope byte payload out of auxiliary receipt and event tables.
- Consider narrowing/storing opaque binary ciphertext (`bytea`) rather than verbose JSON/base64 where compatible with API clients; benchmark end-to-end before claiming size savings.
- Avoid JSONB for fixed, heavily queried columns such as device ID, expiry and delivery state; use a versioned opaque envelope blob for protocol-dependent content.
- Keep transactions short; bound database pools and media transfer concurrency. Profile/logging queries should not share the hot mailbox query plan.
- Monitor autovacuum, index bloat, dead tuples and WAL generation from ephemeral-message churn. Tune only with production-like measurements.

## 5. Device/prekey, profile and backup design

- **Accounts and identity:** local account UUIDs map to trusted self-hosted OIDC issuer/subject pairs; keep passwords and OAuth tokens in the IdP, never in Whispr tables. **Profiles:** split account-private fields (especially email) from opt-in public display data. Add only case-folded unique handle lookup indexes required for discovery.
- **Devices:** one account can have multiple independently revocable devices; tie authorization to the authenticated device, not merely the account.
- **Prekeys:** choose a reviewed protocol/library first. Signed bundles are versioned and verified by clients; one-time prekeys need transactional consume/reservation and bounded replenishment. Do not substitute a plaintext public-key directory for authenticated identity.
- **Backup:** store only opt-in ciphertext plus version/KDF parameters and rollback-protection metadata. Recovery passphrase is distinct from the sign-in secret, and failed decryption never auto-overwrites the remote backup.
- **Media:** store minimal `object_id, owner/device, store_key, ciphertext_size, upload_state, expires_at`. Authenticated short-lived download/upload capabilities must be scoped, not inferred from a publicly guessable object ID. Keep attachment bytes out of PostgreSQL and Redis.

## 6. Client-local database indexes and transactions

```text
LocalStore (logical stores; encrypted values)
├── conversations             by conversation_id
├── messages                  by (conversation_id, local_sort_key, message_id)
├── outbox                    by (retry_at, message_id)
├── inbox_dedupe              by (sender_device_id, envelope_id)
├── crypto_sessions           by (peer_device_id, session_id)
├── identity_pins             by peer_account/device + key version
├── attachments               by (conversation_id, attachment_id)
├── mailbox_sweep_state       per device (pagination only, not permanent commit watermark)
└── encrypted_backup_state    by backup_version
```

**In one local transaction where possible:** commit an incoming message's protected content, session/ratchet advancement, dedup key and UI-visible state **before ACK**. For outgoing sends commit the encrypted envelope, outbox retry state and protocol ratchet advancement together. A crash between those writes must not destroy message decryptability or reuse nonces. If the chosen ratchet/library cannot participate in IndexedDB transactions, design explicit crash-safe staged transitions and test them.

Local full-text search, if added, must stay on the endpoint and not create an unprotected persistent plaintext index. Use protected records, an unlock-time ephemeral search index or an evaluated encrypted local indexing strategy. IndexedDB alone does **not** encrypt at rest; backups and browser eviction remain product requirements.

## 7. Storage lifecycle and measurements

| Record | Created | Removed |
| --- | --- | --- |
| Pending ciphertext | After accepted queue transaction | Recipient durable ACK or TTL expiry |
| Dedup/status key | With first accepted envelope | After terminal state and bounded retry window |
| Wake-up outbox event | Same transaction as first envelope | After publish and bounded event retention |
| Identity / device | Authorized enrollment | Account deletion / revocation retention policy |
| Prekeys | Authorized bundle registration | Consumed, rotated or expired |
| Encrypted media object | Authorized upload | Per-media TTL/cleanup policy; CDN purge may lag |
| Encrypted backup | User's explicit opt-in | User deletion/rotation policy |

**Capacity model** (measure actual values; not a benchmark):

```text
daily_envelopes =
  daily_active_senders * logical_messages_per_sender_day * recipient_devices_per_message

peak_envelopes_per_second =
  daily_envelopes * peak_hour_fraction / 3600

approx_pending_ciphertext_bytes =
  envelope_arrival_rate_per_second * mean_pending_seconds * mean_ciphertext_bytes

add measured index/WAL/tuple overhead, backup retention, retry amplification, and media transfers.
```

Metrics: mailbox read-plan latency, recipient index hit/buffer usage, p95 acceptance/ACK, queued payload bytes/oldest age, terminal key count, event outbox lag, GC batch duration, dead tuples, autovacuum, connections, RLS-denied requests and cross-device status test outcomes. Avoid plaintext or raw contact-graph telemetry.

## 8. When to partition or shard

Start with one unpartitioned PostgreSQL `pending_envelopes` table and correct composite indexes. Batch-delete expired rows and vacuum normally. **Only** when workload measurements show index contention, retention churn or query degradation should you consider hash partitioning by `recipient_device_id` (device-local read locality) or range partitioning (bulk retention). Time partitions are awkward when messages have variable TTLs or cross boundaries; never drop a partition with live pending data.

PostgreSQL partitioned tables can only enforce a partitioned `UNIQUE`/`PRIMARY KEY` when the constraint includes all partition key columns. If changing to time partitioning, redesign deduplication/global uniqueness accordingly rather than assuming `(recipient_device_id,envelope_id)` remains globally enforced on a partitioned pending table. A separate `delivery_keys` ledger remains valuable for bounded deduplication across message partitions.

Never choose active-active regional mailbox writers without single-owner/fenced failover or formally specified conflict semantics for ACK, replays, and revocation.

Reference: [PostgreSQL table partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html).

## 9. Security/RLS contract

Require **backend-owned mailbox APIs** with no browser direct SQL/table grants for internal queue/ledger/event tables. Use least-privilege PostgreSQL roles and RLS where useful as defense-in-depth; **OIDC login is verified at the controller boundary, not delegated to raw SQL**. Backend must verify account-to-device binding, device revocation, scope, envelope ownership and media capability on every operation.

Where direct-access tables/views are intentionally supported, enable RLS with default-deny and explicit SELECT/INSERT/UPDATE/DELETE policies, plus column grants that exclude private email/recovery metadata. Test with two accounts and three devices, including revoked and nonparticipant sessions. An authenticated sender must not choose another `sender_device_id`; an account-level JWT alone may not prove which physical device sent a message.

Transaction design must survive a duplicate enqueue racing with ACK, expiry racing with send, revoked device reconnect, and worker retry. No row-level authorization should depend on stale Redis cache.

## Cloud-hosted PostgreSQL placement (TARGET)

This physical schema remains **Whispr-owned** even when the PostgreSQL service is **managed by a cloud provider**. Hosting options include private AWS RDS PostgreSQL, GCP Cloud SQL or a secured self-operated cluster. Keep the IdP's credential store isolated from mailbox credentials, use private networking, least-privilege SQL roles, cloud secrets and tested backups/restores. Client-owned encrypted history and temporary pending mailbox semantics are unchanged. Cloud-managed storage does not authorize client-side SQL or eliminate the need for controller authorization.

See [Cloud Hosting and Deployment](./16_Cloud_Hosting_and_Deployment.md). The DDL above is illustrative and has not been executed.

## 10. Migration plan — not authorized to execute

1. **Observe**: export live legacy schema/RLS from the authorized Supabase instance; reconcile `server/supabase/migrations/` against `client/src/lib/supabase-chat.js`. Separately test new Whispr-owned accounts/OIDC identity mapping and self-managed PostgreSQL schemas. Run `EXPLAIN (ANALYZE, BUFFERS)` for representative queries in an isolated environment.
2. **Additive schema**: provision **private PostgreSQL (managed cloud DB acceptable)** with Whispr account/OIDC mapping, device directory, ledger, pending ciphertext and outbox while preserving Supabase legacy `messages` and encrypted key backups for read-only migration. Do not drop legacy tables or rotate/destroy keys.
3. **Security gate**: verify grants/RLS/backend authorization, idempotent retries, expiry/ACK races, key bundle verification, account deletion semantics and protected local storage.
4. **Verified identity and dual-read migration**: link existing Supabase identities to self-hosted OIDC accounts with real proof (never email-only merging); recover password-derived legacy key backups **before** changing credentials; clients paginate old ciphertext, decrypt locally, verify and persist protected local copies.
5. **Cutover**: only new messages use the self-hosted Whispr mailbox API; turn off Supabase legacy writes behind a controlled rollout flag. Keep old ciphertext and access available read-only according to documented recovery/rollback obligations.
6. **Retirement**: after verified account and key recovery, successful client migration and rollback/retention policy, decommission Supabase connectors/keys and delete legacy history in authorized bounded jobs. Verify deletion and backups. Never silently drop a live data table.
7. **Load gates**: compare p95/99 acceptance, per-device inbox fetch, ACK, storage/WAL and cleanup costs before introducing partitions, replicas, Redis or sharding.

## 11. Related docs

[Database Design](./08_Database_Design.md) · [System Architecture](./04_System_Architecture.md) · [API Design](./09_API_Design.md) · [Scalability and Caching](./13_Scalability_and_Caching.md) · [Roadmap](./10_Development_Roadmap.md) · [Legacy Supabase Exit](./10_Supabase_Setup.md) · [Self-Hosted Backend](./15_Self_Hosted_Backend_and_Supabase_Exit.md).
