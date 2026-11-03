# Whispr — Development Roadmap

> **This is an incremental redesign of the existing Whispr codebase.** No "Whispr 2.0" repo, duplicate application or separate documentation tree. Status below refers to target work; it is **not complete** just because the current MVP already supports encrypted messaging.

## Guiding decisions

- Keep the existing Next.js UI and reviewed Node/Express/Socket.IO components where useful; **replace Supabase Auth, direct Postgres APIs, Realtime and Storage** with Whispr-controlled interfaces.
- Replace permanent server chat history with encrypted local storage and temporary per-device ciphertext mailboxes.
- Use a reviewed, maintained ratcheting protocol rather than designing custom session cryptography.
- Build encrypted media as an independent client module with temporary server-side ciphertext objects.
- Start with a **self-hosted Node.js/TypeScript modular monolith**, self-managed PostgreSQL, a reviewed self-hosted OIDC provider and private S3-compatible object storage; **not** Kubernetes or a distributed microservices rollout.
- Preserve migration/recovery; do not delete current ciphertext history before clients successfully import it.

## Sequenced work packages / PRs

| Order | Work | Deliverables and exit criteria |
| --- | --- | --- |
| 01 | **Architecture + threat model** | Finalize trust boundaries, protocol/library evaluation, retention and failure semantics; maintain ADRs |
| 02 | **Immediate security fixes** | Require strong JWT secrets, isolate demo tampering/admin, prevent public privileged reads/deletes; security-negative tests |
| 03 | **Legacy inventory + target database** | Reconcile old Supabase schema/RLS and key backups, define **self-hosted** `accounts` + OIDC identity mapping + mailbox tables, secure controller authorization and migration test fixtures |
| 04 | **Encrypted local persistence** | IndexedDB-backed local repository and safe key boundary; outbox, inbox, migration checkpoints; eviction/crash tests |
| 05 | **Self-hosted Auth + device identity** | Evaluate/deploy a reviewed self-hosted OIDC provider, implement token verification/account mapping, step-up device pairing, signed key bundles, warnings and independent recovery flow |
| 06 | **Reviewed E2EE session integration** | Authenticated prekeys/ratchet, per-device sessions, replay/out-of-order test vectors; atomic state commits |
| 07 | **Whispr mailbox controllers** | Own REST controllers/repositories and self-managed PostgreSQL pending ciphertext, stable IDs, validated TTL, ACK, transactional notification outbox and expiry cleanup |
| 08 | **Offline sync engine** | Retry/backoff, reconnect/cursor, duplicate suppression and sender-delivery state machine |
| 09 | **Self-hosted encrypted media** | Client encryption, chunk AEAD, quotas, private S3-compatible object store, scoped capabilities, object cleanup and safe previews |
| 10 | **Media UI + chat experience** | Image/document workflows first; video/voice second; local search and accurate delivery states |
| 11 | **Multiple devices and backup** | Device pairing, independent sessions, account-login-independent recovery secret, versioned recovery |
| 12 | **Supabase exit + release** | Verified old/new identity linking, password-derived legacy keyring recovery/rekey, client history import, safe cutover/rollback, Supabase retirement only after authorized data validation |

## Release gates

**Gate A — safety:** no weak production signing secret, no unauthenticated demo admin capability, self-hosted OIDC validation + controller authorization (with least-privilege DB roles/RLS where appropriate), no plaintext key export via ordinary local storage, no password-reused backup key.

**Gate B — functional one-to-one:** audited protocol choice; encrypted local history; durable offline queue; idempotent delivery/ACK; reconnect/replay/crash tests; user-visible identity verification.

**Gate C — attachments:** files always encrypted before upload; authenticated chunking, safe previews, capped sizes, retention cleanup and malicious-object tests.

**Gate D — migration:** source history counted and decryptable, safe old-to-local import, backup recovery verified, old tables deleted only after explicit policy and rollback window.

## Optimized database work — within existing PR sequence

**Work package 03 (schema):** reconcile the *actual legacy* Supabase schema and committed migration drift, then validate a **self-managed PostgreSQL minimal server model**: `devices`, protocol-selected signed/prekey tables, a composite-PK `delivery_keys` ledger, ciphertext-only `pending_envelopes`, narrow `mailbox_events` transactional outbox, minimal `media_objects`, and opted-in encrypted backup metadata. Keep email out of public profiles and do not add a permanent server conversation search table.

**Work package 04 (client DB):** define protected local message indexes `(conversation_id, local_sort_key, message_id)`, atomic crypto-state/inbox/outbox writes, dedup markers, quota/eviction behavior and local-only search without persisted plaintext indexes.

**Work packages 07–08 (mailbox):** implement Whispr-controlled authenticated mailbox controllers; accept envelope/ledger/event in one self-managed PostgreSQL transaction; ACK deletes ciphertext but retains a time-bounded status tombstone; expiry is terminal; validate sender retries, concurrent ACK/send and crash windows. Mailbox keyset cursor is per-scan only—never an assumed commit-order permanent high-water mark. Use pagination and restart sweeps to avoid missing late commits.

**Release/scale gate:** benchmark query plans, B-tree hit rates, WAL, dead tuples, cleanup batch cost, RLS/security-negative tests, transaction contention, p95 fetch and ACK latency and long-offline device growth **before** partitioning, introducing replicas or changing DB providers.

This proposal is documented in [Optimized Database Design](./14_Optimized_Database_Design.md) and has **not** been implemented or benchmarked.

## Supabase removal — mandatory migration gates

1. **Inventory + backup** the real legacy Supabase schema/RLS, account identities, encrypted history and encrypted key backups. Keep legacy migration files in the repository.
2. **Deploy isolated self-hosted services:** a reviewed OIDC provider (Keycloak is a candidate, not an installed dependency), Whispr backend controllers, self-managed PostgreSQL and private S3-compatible object storage. Docker Compose is acceptable for development.
3. **Build account-identity mapping:** local account UUID + verified OIDC `(issuer,subject)`; never merge users solely because emails match. Do not transplant demo JWT code or invent password/OAuth authentication.
4. **Protect E2EE recovery:** restore the legacy password-derived keyring before account credentials change; re-encrypt backups with an independent recovery secret and test on a fresh device.
5. **Additive cutover:** implement mailbox/controller contracts and local encrypted history; migrate legacy messages client-side with integrity checks and checkpoints; switch *new* messages behind controlled rollout.
6. **Retire Supabase only after** account matching, per-device delivery, backup restore, rollback and retention/deletion verification. No premature deletion.

**Target tree** remains inside the existing repo: `server/src/modules/{auth,devices,keys,mailbox,media,realtime,recovery}`, `server/src/workers`, `server/src/infrastructure/{postgres,oidc,redis,object-store}`, `server/migrations` and `infrastructure/compose`. Do not assume these paths exist today.

See [Self-Hosted Backend and Supabase Exit](./15_Self_Hosted_Backend_and_Supabase_Exit.md).

## Testing and CI

Unit: envelope validation, crypto test vectors, backup errors, local DB and retention.

Integration: PostgreSQL/RLS with nonparticipant accounts, reconnection, ACK retry, untrusted key directory, expired envelopes and authorization.

End-to-end: two isolated browsers/devices, device loss/recovery, XSS-hardened message rendering, encrypted image/document transfer and duplicate/out-of-order events.

Failure injection: crash between session advancement and disk commit, crash before ACK, network partition, corrupted local storage, tampered ciphertext and partial media upload.

No "100% secure", "fully merged" or "production-ready" claim without verified evidence and a separate security review.

## Scalability, caching and operational acceptance (part of the existing work)

Integrate the following into the **existing ordered PR plan**; they do not require a parallel release or a separate platform team:

| Work package | Additional acceptance criteria |
| --- | --- |
| 03 — DB contract | Real RLS tests, device-scoped envelope authorization, keyset indexes, idempotency, TTL/cleanup plan and partitioning decision record |
| 04 — Local persistence | RAM view-cache bounds, encrypted IndexedDB/OPFS store, quota/eviction handling, safe recovery and crash-atomic session/outbox commits |
| 07 — Delivery mailbox | PostgreSQL transactionally persisted envelope + event-outbox, at-least-once wake-up, retry/ACK state machine, expiry and backlog alerts |
| 08 — Offline sync | Reconnect catch-up independent of WebSocket events, dedup after crashes, gateway draining, throttling/backoff and loss-of-Redis chaos test |
| 09 — Media | Direct client-encrypted chunk transfers, upload concurrency quota, scoped signed URLs, CDN cache authorization, orphan cleanup and media TTL policy |
| 12 — Release | Load tests with peak envelope/device fanout, queue age and ACK latency, browser storage loss, Redis outage, malicious public-key cache, gateway restart and DB overload |

### Cache implementation sequence

**Design now:** self-hosted OIDC issuer/subject account mapping, backend authorization boundaries, cache allowlists, TTL candidates, invalidation/revocation, presence/rate-limit semantics and failure modes.

**Implement when needed:** Redis for multi-gateway routing/presence or demonstrated metadata cache gains; keep pending ciphertext in PostgreSQL. Treat rate-limit counters as security controls with isolation from general cache eviction.

**Defer until measured:** table partitioning, more than one regional mailbox writer, Kafka, large shared CDN for encrypted media and multi-region active-active deployments.

### Proposed performance SLOs (not currently measured)

Mailbox acceptance p95 below 250 ms and online recipient delivery p95 below 2 seconds for an agreed load profile; mailbox API 99.9% monthly target; zero logical duplicate user messages under replay/crash tests; bounded pending queue age, delivery retries and expiry-worker backlog. Validate via reproducible load/chaos tests before making release claims.

Implementation-level details and failure matrix: [Scalability and Caching](./13_Scalability_and_Caching.md).

## Explicitly deferred

Group chats/MLS, calls, federation, large-scale microservices, optional social/discovery features. Keep existing `/demo` isolated as an educational harness while `/app` becomes the single intended product implementation.

See [API](./09_API_Design.md), [Data](./08_Database_Design.md), [Security](./05_Cryptography_Security_Flow.md), and [Threat Model](./06_Threat_Model.md).
