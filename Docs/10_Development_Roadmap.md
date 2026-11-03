# Whispr — Development Roadmap

> **This is an incremental redesign of the existing Whispr codebase.** No "Whispr 2.0" repo, duplicate application or separate documentation tree. Status below refers to target work; it is **not complete** just because the current MVP already supports encrypted messaging.

## Guiding decisions

- Keep existing Next.js UI, Supabase account authentication and PostgreSQL where they help.
- Replace permanent server chat history with encrypted local storage and temporary per-device ciphertext mailboxes.
- Use a reviewed, maintained ratcheting protocol rather than designing custom session cryptography.
- Build encrypted media as an independent client module with temporary server-side ciphertext objects.
- Start with a backend **modular monolith**, not Kubernetes or a distributed microservices rollout.
- Preserve migration/recovery; do not delete current ciphertext history before clients successfully import it.

## Sequenced work packages / PRs

| Order | Work | Deliverables and exit criteria |
| --- | --- | --- |
| 01 | **Architecture + threat model** | Finalize trust boundaries, protocol/library evaluation, retention and failure semantics; maintain ADRs |
| 02 | **Immediate security fixes** | Require strong JWT secrets, isolate demo tampering/admin, prevent public privileged reads/deletes; security-negative tests |
| 03 | **Database contract reconciliation** | Correct fresh Supabase migrations, RLS tests, separate private email from public directory, identify Express-vs-Supabase adapters |
| 04 | **Encrypted local persistence** | IndexedDB-backed local repository and safe key boundary; outbox, inbox, migration checkpoints; eviction/crash tests |
| 05 | **Device identity and key verification** | Signed identity bundles, device registration, key-change warnings, safety number and recovery flow |
| 06 | **Reviewed E2EE session integration** | Authenticated prekeys/ratchet, per-device sessions, replay/out-of-order test vectors; atomic state commits |
| 07 | **Temporary encrypted mailbox** | Per-device envelope queues, stable IDs, validated TTL, sender receipts, durable ACK, expiration cleanup |
| 08 | **Offline sync engine** | Retry/backoff, reconnect/cursor, duplicate suppression and sender-delivery state machine |
| 09 | **Encrypted attachment engine** | Client encryption, chunk AEAD, quotas, signed scoped download capabilities, object expiry |
| 10 | **Media UI + chat experience** | Image/document workflows first; video/voice second; local search and accurate delivery states |
| 11 | **Multiple devices and backup** | Device pairing, independent sessions, account-login-independent recovery secret, versioned recovery |
| 12 | **Legacy migration + release** | Import/verify old ciphertext on client, safe cutover, security/perf tests, telemetry minimization, docs |

## Release gates

**Gate A — safety:** no weak production signing secret, no unauthenticated demo admin capability, strict RLS, no plaintext key export via ordinary local storage, no password-reused backup key.

**Gate B — functional one-to-one:** audited protocol choice; encrypted local history; durable offline queue; idempotent delivery/ACK; reconnect/replay/crash tests; user-visible identity verification.

**Gate C — attachments:** files always encrypted before upload; authenticated chunking, safe previews, capped sizes, retention cleanup and malicious-object tests.

**Gate D — migration:** source history counted and decryptable, safe old-to-local import, backup recovery verified, old tables deleted only after explicit policy and rollback window.

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

**Design now:** cache allowlists, TTL candidates, invalidation/revocation rules, presence and rate-limit semantics, and failure modes.

**Implement when needed:** Redis for multi-gateway routing/presence or demonstrated metadata cache gains; keep pending ciphertext in PostgreSQL. Treat rate-limit counters as security controls with isolation from general cache eviction.

**Defer until measured:** table partitioning, more than one regional mailbox writer, Kafka, large shared CDN for encrypted media and multi-region active-active deployments.

### Proposed performance SLOs (not currently measured)

Mailbox acceptance p95 below 250 ms and online recipient delivery p95 below 2 seconds for an agreed load profile; mailbox API 99.9% monthly target; zero logical duplicate user messages under replay/crash tests; bounded pending queue age, delivery retries and expiry-worker backlog. Validate via reproducible load/chaos tests before making release claims.

Implementation-level details and failure matrix: [Scalability and Caching](./13_Scalability_and_Caching.md).

## Explicitly deferred

Group chats/MLS, calls, federation, large-scale microservices, optional social/discovery features. Keep existing `/demo` isolated as an educational harness while `/app` becomes the single intended product implementation.

See [API](./09_API_Design.md), [Data](./08_Database_Design.md), [Security](./05_Cryptography_Security_Flow.md), and [Threat Model](./06_Threat_Model.md).
