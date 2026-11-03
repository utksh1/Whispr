# Whispr — Core Features

> **One existing product, incremental redesign.** This is the target feature backlog, **not** a claim that these capabilities are already shipped.

## Current application

- `/app`: Supabase account authentication, browser-side P-256/AES-GCM message encryption, server-stored ciphertext, Realtime updates, account discovery and encrypted remote keyring backup.
- `/demo`: separate Express/Socket.IO demonstration with optional ciphertext-tampering capability.
- Existing image/file/video flows, secure per-device ratcheting, local encrypted message history, reliable offline outbox, multi-device device fanout and protected local key persistence are **not implemented as designed below**.

## P0 — Core architecture and usable private messaging

| Feature | Acceptance requirement |
| --- | --- |
| Encrypted local message history | Messages persist in device-local encrypted database; no permanent server conversation archive |
| Per-device pending mailbox | Authenticated ciphertext fetch, idempotent send, durable ACK, configurable TTL, expiry cleanup |
| Offline reliability | Durable sender outbox; retry after restart; ACK only after recipient's local commit |
| Reviewed one-to-one E2EE | Authenticated session setup, forward-secret ratcheting, replay and out-of-order handling |
| Key verification | Safety numbers/QR verification, pinned identity, visible unexpected key-change warnings |
| Secure key/recovery management | No plaintext PKCS#8 in `localStorage`, separate login/backup secrets, no silent backup overwrite |
| Encrypted image and document transfer | Client encryption, authenticated manifest/chunks, private temporary object storage |
| Account and privacy settings | Device/security settings, retention disclosure, safe errors, recoverability warnings |
| Security hardening | Strong mandatory secrets, closed demo admin surface, RLS/tenant isolation, negative CI tests |

### P0 — Scalability requirements for core delivery

- Durable PostgreSQL acceptance with sender-visible retryable failure under overload; no `accepted` result before commit.
- Device-scoped idempotent envelope IDs, keyset mailbox pagination, bounded TTL/expiry, and **transactional outbox** for non-durable WebSocket wake-up hints.
- Multi-instance-ready stateless realtime gateway and reconnect fetch that survives Redis Pub/Sub loss.
- Safe public metadata cache allowlist; no plaintext chat/key/backup/session-token values in Redis or a CDN.
- Per-account/device rate limits, pending-byte caps, connection and media concurrency quotas; conservative behavior when the security counter store fails.
- Recipient ACK after local durable save, replay/duplicate protection, bounded retries and no cross-device premature envelope deletion.
- Baseline load tests for queue aging, database saturation and gateway reconnect storms with redacted operational telemetry.

See [Scalability and Caching](./13_Scalability_and_Caching.md). Redis and CDN are **optional infrastructure**, not preconditions to ship the first local-first core.

### P0 — Self-hosted backend requirements

- No runtime dependency on Supabase Auth, PostgREST, Realtime or Storage **after a verified migration**; legacy connections retained only for permitted temporary read/rollback.
- Reviewed self-hosted OIDC authentication (Keycloak is a candidate), Whispr Auth Controller token validation and stable verified `(issuer,subject)` → local account UUID mapping; no DIY password/OAuth/JWT cryptography.
- Device enrollment and revocation as independently secured flows; account login alone cannot silently replace a peer E2EE identity.
- Self-managed PostgreSQL with device-scoped ciphertext mailbox, compact dedup/ACK ledger, transactional event outbox and narrow data access through Whispr controllers.
- Whispr-owned Socket.IO gateway for wake-up hints; private S3-compatible object store for client-encrypted attachment bytes; optional Redis for reconstructible coordination only.
- Safe Supabase exit: authorized legacy export, old backup restore under old credential, independent recovery secret rekey, verified client-local history import, rollback and delayed decommission.
- Docker Compose isolated development stack, production HTTPS/secret isolation, backup/restore drills and CI security-negative tests.

These are **planned acceptance requirements**, not existing deployed features. See [Self-Hosted Backend and Supabase Exit](./15_Self_Hosted_Backend_and_Supabase_Exit.md).

## P1 — Product completeness

Resumable video and voice-note attachments; local-only message search; message statuses (queued, accepted, delivered, optionally read); block/report controls; delete-for-me and best-effort remote delete requests; encrypted backup export/restore; multiple authorized devices with device-specific sessions and per-device delivery.

## P2 — Explicitly deferred

Group messaging (consider MLS), encrypted calling, social/discover feeds, rich reactions, large-scale server federation and anonymity features. Do not delay secure one-to-one chat to build these.

## UX guarantees and non-guarantees

- "Server accepted" is not "recipient delivered"; "delivered to device" is not "read by human".
- "Delete for everyone" is best effort; it cannot remove screenshots, exported copies or offline backups.
- Browser-local storage may be cleared/evicted. Users need recovery options and explicit warnings.
- The relay can know delivery metadata. Avoid claiming the service is metadata-blind.
- Encrypted file upload must not bypass client-side content validation and safe preview rules.

## Demo tooling policy

A ciphertext inspection/tampering demo may be preserved in a separate, non-production-only environment with explicit authorization and never with public privileged admin access. Demo-only controls must not be framed as production features.

See [System Architecture](./04_System_Architecture.md), [Security Flow](./05_Cryptography_Security_Flow.md), [Roadmap](./10_Development_Roadmap.md).
