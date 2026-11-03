# Whispr — API and Delivery Protocol Design

> **Status:** Existing APIs are documented below as **current/legacy**. The mailbox and media interfaces are **proposals for the same Whispr project**, not implemented endpoints. Do not write clients against the proposed routes until an API ADR and OpenAPI contract are approved.

## 1. Current integration surfaces

### Product application: `/app`

The browser currently calls **Supabase Auth, Postgres and Realtime directly**. `client/src/lib/supabase-chat.js` reads/writes server-retained ciphertext in `messages`; it also accesses `profiles`, `user_keys` and `private_key_backups`. Client-side encryption is implemented in `client/src/lib/crypto.js`. Database-column expectations in this client are not fully reconciled with the committed migrations.

### Demo application: `/demo`

The separate Express/Socket.IO service implements these endpoints:

| Method | Path | Current intent |
| --- | --- | --- |
| POST | `/auth/register`, `/auth/login` | Issue demo JWT and user profile |
| GET | `/auth/me` | Session verification |
| PUT | `/me/public-key` | Set/rotate active public key |
| PUT/GET | `/me/private-key-backup` | Store/fetch encrypted legacy keyring backup |
| GET | `/users` | User discovery |
| GET | `/users/:username/public-key` | Public key lookup |
| GET | `/keys/:keyId` | Historical public key lookup |
| POST | `/conversations/:peerUsername/messages` | Store encrypted message |
| GET | `/conversations/:peerUsername/messages` | Retrieve retained encrypted history |
| POST | `/messages/:messageId/tamper` | Demo-only ciphertext corruption |

Demo Socket.IO currently uses a JWT at connection and `message:receive` / `message:tampered` events. Authentication, persistence and user IDs are **not interchangeable** with the `/app` Supabase path. Demo routes are not the target mailbox protocol.

**Security blockers:** demo JWT accepts a predictable fallback when unset; privileged Next.js demo admin APIs may be enabled without authorization; demo tamper feature must be isolated. Neither should be exposed in production.

## Target replacement: self-hosted Whispr controllers (NOT IMPLEMENTED)

Whispr's production client will use **only the Whispr-controlled API and realtime gateway**, rather than the Supabase browser SDK or direct PostgREST table access. The backend is a Node.js/TypeScript modular monolith: `AuthController`, `DeviceController`, `KeyController`, `MailboxController`, `RealtimeController`, `MediaController` and `RecoveryController`, with separate workers for expiry and transactional notifications.

**Authentication flow:** a reviewed self-hosted OIDC provider (Keycloak is a candidate) authenticates users. The Whispr Auth Controller validates trusted JWT issuer, audience, signature, expiry and JWKS, maps the verified `(issuer,subject)` to a stable local `account_id`, and authorizes each device-scoped request. Whispr **does not** issue its own weak fallback-secret production JWTs or implement password/OAuth flows from scratch.

**Target auth/account interfaces (illustrative):**

| Method | Proposed path | Contract |
| --- | --- | --- |
| GET | `/v1/me` | Authenticated Whispr account from verified OIDC identity mapping |
| POST | `/v1/me/identity-links` | Step-up/verified identity link; no email-only auto merge |
| GET | `/v1/me/devices` | Owned devices, cryptographic identity fingerprints and revocation state |
| POST | `/v1/me/devices` | Authenticated new-device enrollment with pairing/step-up proof |
| DELETE | `/v1/me/devices/:deviceId` | Revoke device; block future mailbox delivery/prekey access |

The IdP owns password/MFA/reset pages and token issuance; product APIs own data authorization and E2EE device policies. Configure strict CORS, TLS, CSRF protection for cookie-backed operations, safe token storage and session revocation rules. A normal OIDC login is **not** proof that a new messaging device is legitimate.

**Storage flow:** Whispr's API validates account/device ownership, queries private Whispr PostgreSQL (cloud-managed or self-operated), and grants limited S3-compatible object-storage capabilities for *client-encrypted* media. Redis is optional for presence/cache; it is never authoritative for authorization or pending messages.

**Current `/demo` authentication is a separate legacy test harness** and must not be rebranded as production auth. See [Self-Hosted Backend and Supabase Exit](./15_Self_Hosted_Backend_and_Supabase_Exit.md).

## 2. Target API principles

1. Client owns long-term history; **Whispr-controlled controllers backed by Whispr-controlled PostgreSQL (cloud-managed acceptable)** store only **pending encrypted envelopes**, never full delivered transcripts.
2. Every request is authorized for a specific account and device by a **Whispr service/policy layer** after verifying OIDC identity and device proof. Senders cannot choose arbitrary `sender_id`; client-submitted account/device claims are not trusted.
3. All routes are versioned (e.g. `/v1`), schema-validated and rate-limited. Use opaque message IDs and exact envelope size/TTL limits.
4. HTTP queue persistence is durable; websocket/realtime events are **hints**, not delivery proof.
5. Retries are idempotent. ACK is accepted **only after local durable persistence**, not merely receipt of a network packet.
6. Public-key directory integrity is a **client verification** responsibility. A directory response alone is not a human identity guarantee.
7. Server does not receive plaintext chat, media decryption keys or recovery passphrases.

## 3. Target proposed endpoints (NOT IMPLEMENTED)

### Accounts, devices and key bundles

| Method | Proposed path | Contract |
| --- | --- | --- |
| GET | `/v1/me/devices` | List only caller's authorized devices and key fingerprints |
| POST | `/v1/me/devices` | Register a new device after explicit account/device proof |
| DELETE | `/v1/me/devices/:deviceId` | Revoke device and stop future queues/prekeys |
| GET | `/v1/users/:userId/devices` | Fetch public device identifiers + signed authenticated key bundles |
| POST | `/v1/me/devices/:deviceId/prekeys` | Replenish signed/one-time prekey bundle |

Device registration and identity-key changes require auditable user-visible policies, not implicit trust of a new public-key row.

### Encrypted delivery mailbox

| Method | Proposed path | Contract |
| --- | --- | --- |
| POST | `/v1/envelopes` | Idempotently enqueue opaque E2EE envelope for an authorized recipient device |
| GET | `/v1/me/devices/:deviceId/envelopes?cursor=...&limit=...` | Fetch pending envelopes belonging to caller's device |
| POST | `/v1/me/devices/:deviceId/envelopes/:envelopeId/ack` | Mark durable-local-commit success; remove pending item |
| GET | `/v1/outbox/:envelopeId/status` | Status for sending device (accepted, delivered, expired, failed) |

Example target request (illustrative, **not** implemented):

```json
{
  "envelope_id": "opaque-random-id",
  "recipient_device_id": "opaque-device-id",
  "protocol_version": "to-be-selected",
  "payload": "base64-authenticated-ciphertext",
  "expires_at": "server-validated-expiration"
}
```

Server binds `sender_account_id` and `sender_device_id` from authenticated context. It validates recipient membership, maximum size and expiration; it must not trust client-submitted senders or ownership fields.

Example target queue response:

```json
{
  "envelope_id": "opaque-random-id",
  "status": "accepted",
  "recipient_device_id": "opaque-device-id",
  "expires_at": "server-assigned-expiration"
}
```

**Delivery contract:** the sender may retry the same `envelope_id` after network failure; repeated sends must not duplicate delivery. An ACK from the authenticated recipient device is idempotent. Lost ACKs cause safe redelivery; the client must deduplicate without rolling back cryptographic state. Expired envelopes generate sender-facing expiry status when feasible. The service cannot guarantee availability if the server itself is malicious or offline.

### Encrypted media

| Method | Proposed path | Contract |
| --- | --- | --- |
| POST | `/v1/media/uploads` | Create quota-limited encrypted upload session |
| PUT | `/v1/media/uploads/:uploadId/chunks/:index` | Upload opaque ciphertext chunk with bounded size |
| POST | `/v1/media/uploads/:uploadId/complete` | Commit encrypted object and server-verifiable ciphertext layout |
| GET | `/v1/media/:opaqueId/capability` | Issue short-lived, authorized retrieval capability |
| DELETE | `/v1/media/:opaqueId` | Request lifecycle cleanup subject to ownership and retention rules |

The decryption key, plaintext filename/MIME, sensitive manifest and file integrity metadata belong **inside an E2EE message**. Signed URLs are short-lived and scoped. A server-side SHA checksum is not a replacement for client AEAD verification.

### Realtime hints

| Proposed event | Meaning |
| --- | --- |
| `mailbox:available` | Device should fetch envelopes over authenticated API |
| `device:directory-changed` | Refresh device directory and check identity bindings |
| `media:transfer-state` | Optional transfer progress hint |
| `session:revoked` | Reauthenticate and stop receiving future data |

Do not send plaintext previews over push or realtime events.

## 4. Status semantics

`local_queued` = encrypted and durably committed to sender outbox; `accepted` = relay durably queued; `delivered` = recipient device committed and ACKed; `read` = optional user-granted receipt; `expired` = relay discarded undelivered ciphertext; `failed` = non-retryable error. A single logical message can have **different delivery states per recipient device**.

## 5. Security and concurrency requirements

Use strict tenant/device RLS or equivalent backend authorization; explicit prekey consumption and replay protections; TLS with real certificate verification; content-size quotas, auth-rate limits, account/device revocation, idempotency keys, safe optimistic concurrency and bounded retries. Errors must not leak user lookup data unnecessarily. The client must not mark cryptographic integrity as correspondent-identity verification.

## 6. Horizontal scaling, caching and overload contract (TARGET / NOT IMPLEMENTED)

**Delivery acceptance** occurs only after a durable PostgreSQL commit. A successful WebSocket or Redis Pub/Sub publish is *not* acceptance or delivery evidence. The server commits a transactional event-outbox entry with the pending envelope; worker publication may retry without duplicating user messages.

- `GET /v1/me/devices/:deviceId/envelopes` uses opaque **keyset cursors**, bounded `limit`, tenant/device authorization and forward-safe pagination; no unbounded offset-based history scan.
- `POST /v1/envelopes` uses stable per-device envelope/idempotency IDs, strict size quotas and a server-authoritative expiry. If persistence fails, the API must not return `accepted`.
- `POST .../ack` is device-authenticated, idempotent and updates pending/receipt state transactionally; a sender may query recipient-specific statuses without learning unrelated account activity.
- Realtime `mailbox:available` is a wake-up hint. After reconnect, clients must authenticate and **fetch pending mailbox envelopes even if no event arrives**.
- Where access is throttled or capacity is exhausted, return appropriate `429`/`503` plus retry policy/`Retry-After`; clients use jitter, bounded exponential backoff and stable idempotency IDs.
- Media upload APIs authorize direct transfer of **encrypted bytes**, chunk limits, resumability and short-lived capabilities. Media retrieval must not allow a cross-account cache-key or signed-URL authorization bypass.
- Public directory API caches may serve only signed/versioned, non-private fields. Account/device authorization and key-change verification may not be bypassed on a Redis cache hit.
- Cache-only realtime/presence failures must not cause loss of PostgreSQL pending mail; rate-limit subsystem failure requires conservative fallback/fail-closed behavior as defined by route risk.

**Metrics proposals (not measured):** acceptance p95 under 250 ms, online device delivery p95 under 2 s, mailbox API 99.9% monthly availability. Measure queue depth/age, retries, ACK latency, gateway connections, Redis eviction and DB saturation without plaintext, secrets or raw social graphs.

See [Scalability and Caching](./13_Scalability_and_Caching.md) for cache keys/TTLs and operational failure tests.

## 7. Database-aware mailbox API constraints (TARGET / NOT IMPLEMENTED)

The public HTTP route `/v1/envelopes` is a **logical contract**, not a direct browser-table API. The optimized physical proposal uses:

- `delivery_keys`: composite `(recipient_device_id,envelope_id)` idempotency/status metadata, retained after ACK or expiry for a bounded retry window.
- `pending_envelopes`: **only** undelivered ciphertext, removed after ACK/expiry, with per-device keyset index.
- `mailbox_events`: minimal transactionally persisted notification intent; independent worker publishes best-effort realtime hints. The sender receives `accepted` **only after the PostgreSQL transaction commits all relevant records**.
- Large encrypted attachment bytes stay in private object storage; `media_objects` contains only object references/retention metadata.

**Fetch cursor caveat:** `created_at` plus `envelope_id` is suitable for paging one scan, not a permanent high-water cursor across concurrent transactions. Clients restart pending-mailbox sweeps from the beginning on reconnect and periodically; they deduplicate by envelope ID and maintain independently protected local cryptographic state.

**ACK semantics:** authenticate the recipient device, lock/compare the matching ledger record, transition pending to delivered and delete ciphertext **in one transaction**. A repeated ACK must return the same terminal result; a sender's idempotent retry must not recreate deleted ciphertext. The dedup window is bounded; protocol-level replay resistance is still required.

**Backend security:** Self-managed PostgreSQL is private to Whispr services and uses least-privilege roles, with optional RLS defense-in-depth. **OIDC claims must be validated and mapped** before every device-bound request; no broad browser database access. Authorize each sender-device, recipient-device fetch, ACK, and media object capability at the API boundary; validate with adversarial tests.

See [Optimized Database Design](./14_Optimized_Database_Design.md) for SQL examples and migration restrictions.

## Preferred Vercel + Render and optional R2 API deployment (TARGET)

The Next.js frontend is **planned for Vercel**; Whispr's HTTP controllers and Socket.IO gateway run on an **always-on Render web service**. PostgreSQL is **paid Render PostgreSQL** for persistent pending ciphertext. A reviewed OIDC provider deployed separately on Render authenticates users. Browser code gets only public API/OIDC configuration; connection strings, private R2 credentials and OIDC server secrets stay on Render.

**Text-only APIs must not require object storage.** The proposed `/v1/media` endpoints remain feature-gated until encrypted attachments ship. When enabled, the Media Controller authorizes object/size/TTL and returns short-lived **private Cloudflare R2 S3 presigned PUT/GET** capabilities. The browser transfers **only locally encrypted bytes** directly to R2. R2 CORS must allow exact Vercel app origins, proper methods and signed headers. An R2 URL is a bearer capability and must not be publicly logged or converted to a public bucket URL. Direct R2 S3 presigned links cannot simply use arbitrary custom media hostnames. AWS S3 or another provider is an adapter alternative, not required.

Socket.IO hints are never reliable delivery, whether Render uses one gateway or multiple; reconnect initiates mailbox fetch and client dedup. Implement `429/503` backpressure, device-specific authorization and token/redirect/CORS policy.

See [Vercel + Render + Optional R2](./17_Render_Vercel_R2_Deployment.md).

## 8. Supabase exit and API ownership

Replace Supabase Auth/PostgREST/Realtime/Storage with Whispr-owned APIs, a self-hosted standards-based OIDC provider, the Whispr Socket.IO gateway and private S3-compatible ciphertext storage. **Do not treat Supabase IDs, session tokens or legacy Google OAuth identity fields as interchangeable with Whispr account UUIDs.** Link verified old identities safely, and recover legacy password-derived key backups before old login credentials change. Client local history and the new server mailbox are two separately migrated concerns.

The current direct browser Supabase queries are **legacy read/migration-only** during staged cutover; no direct database calls belong in the target client. See [Self-Hosted Backend and Supabase Exit](./15_Self_Hosted_Backend_and_Supabase_Exit.md).

## 9. Compatibility and rollout



- Keep legacy endpoints for existing demo and message migration during transition, behind isolation/feature flags where appropriate.
- Inventory the actual Supabase schema before writing migrations; the committed SQL is currently inconsistent with the client contract.
- Use new API contracts alongside legacy storage, migrate history on client, then disable new legacy writes and eventually retire server archives under an explicit policy.
- Maintain machine-readable OpenAPI docs and negative security tests for both migration and new APIs.

See [Database Design](./08_Database_Design.md), [Architecture](./04_System_Architecture.md), [Roadmap](./10_Development_Roadmap.md).
