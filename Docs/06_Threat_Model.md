# Whispr — Threat Model

> **Scope:** Existing Whispr project and its planned local-first redesign. Controls identified as **target** are not yet delivered.

## Assets

Message plaintext; attachment plaintext; private device identity and session keys; local conversation database; recovery secrets; public-key identity bindings; authentication sessions; recipient/device routing metadata; availability of queued messages.

## Trust boundaries

1. **Endpoint device**: trusted only while uncompromised. Browser script delivery, extensions, XSS and filesystem access are relevant threats.
2. **Auth and key directory**: account authentication is distinct from verified messaging identity. Server directory responses may be stale, forged or malicious.
3. **Message delivery backend**: sees opaque envelopes, sender/recipient device identifiers, network/timing metadata and queue state. It must not see plaintext or store a permanent chat archive.
4. **Attachment storage**: receives encrypted blobs and access metadata, not file encryption keys.
5. **Recovery system**: stores E2EE backup ciphertext; account login secrets must not decrypt it.

## Threat and control matrix

| Attacker capability / failure | Risk | Required control |
| --- | --- | --- |
| Database read/dump | Ciphertext/metadata disclosure | E2EE + minimum metadata, short TTL, strict RLS |
| Full backend API compromise | Key substitution, mail deletion/replay, metadata inference | Pinned/verified peer identities, anti-replay, limited server claims; availability cannot be guaranteed |
| Malicious JavaScript from web origin / XSS | Plaintext and keys exposed through browser operations | CSP, supply-chain checks, safe rendering; native signed app for stronger delivery trust |
| JWT signing secret leaked or defaulted | Unauthorized demo backend sessions | Mandatory strong per-deployment secret, negative auth tests |
| Exposed demo administrator APIs | Private backup/ciphertext reads, remote deletion | Disable by default, remove from product path, explicit authorization |
| Stored plaintext/exportable private keys | Key theft on XSS/device access | Protected key manager, encrypt local records, explicit export |
| Authentication password reused for backup | Compromised auth service can derive backup key | Independent recovery secret and memory-hard KDF |
| Fake or rotated public key | Undetected impersonation | Safety numbers, pinning, user-visible change confirmation |
| Replay, duplicate and reordered envelopes | Duplicate rendering or ratchet desync | Stable IDs, replay window, idempotency, crash-safe ratchet commits |
| Interrupted mailbox delivery | Lost messages or incorrect read state | Durable outbox, ACK only after device save, retry + expiry states |
| Malicious attachments | Unsafe local preview, resource exhaustion | Type/size limits, safe renderers, authenticated chunks, quotas |
| Device loss or storage eviction | Permanent message loss | User-controlled backups and paired-device recovery |
| Recipient exports or screenshots | Irreversible disclosure | Explicitly out of cryptographic deletion guarantees |

## Metadata privacy

E2EE does **not** hide all metadata. The service may learn which device accounts communicate, login IPs, delivery timing, payload sizes, media object sizes and online state. Minimize and document logs, data retention and analytics. Push notifications must not contain message plaintext or sensitive previews.

## Cache, realtime and scale-specific security threats (target)

| Threat | Impact | Required defense |
| --- | --- | --- |
| Redis outage or Pub/Sub hint loss | Users appear offline; realtime wake-up lost | PostgreSQL authoritative mailbox, transactional notification outbox, reconnect fetch |
| Redis eviction disables rate limits | Brute force / send spam | Separate or reserved security-state policy; conservative fallback or fail closed for high-risk actions |
| Cross-account metadata cache pollution | Profile/key information revealed | Explicit allowlists, scoped keys, auth before cache access, negative-cache design |
| Stale cached device authorization | Revoked device continues receiving | Authoritative revocation/epoch checks; bound capabilities and client identity verification |
| CDN caching wrong auth key/URL | Ciphertext access across users | Private origin, scoped short-lived URLs, correct cache key/vary rules, media authorization tests |
| CDN retains ciphertext after origin delete | Retention promise violated | CDN purge/expiry coordination, policy disclosure, no instant-erasure claims |
| Gateway reconnect storm | Overload and message delay | Bounded per-device backoff+jitter, admission control, gateway draining, queue SLO alerts |
| DB connection/queue exhaustion | Missed or falsely acknowledged messages | Durable commit before accepted, backpressure 429/503, quotas and circuit breakers |
| Region split-brain during failover | Duplicate/contradictory ACK, deletion, revocation | One authoritative home writer per device and fenced failover |
| Telemetry contains contact graph | Privacy violation despite E2EE | Minimize IP/recipient identifiers, use redacted/aggregated metrics, bounded logs |

**Never cache** message plaintext, recovery material, authentication bearer tokens, private device keys or plaintext previews in Redis/CDNs/shared HTTP/Service Worker caches. Encrypted local IndexedDB/OPFS records are the user's history, not disposable relay caches; browser origin compromise and storage eviction remain threats.

Caching key bundles for 30–120 seconds is a **candidate operational TTL**, never a substitute for user-verifiable identity binding. Realtime presence is approximate and must not be represented as reliable user intent or guaranteed availability.

See [Scalability and Caching](./13_Scalability_and_Caching.md).

## Self-hosted control-plane and migration threats (TARGET)

| Threat | Consequence | Mandatory mitigation |
| --- | --- | --- |
| DIY password/JWT/OAuth flow | Credential takeover, forged sessions | Choose a maintained self-hosted OIDC provider, validate JWT signature/issuer/audience/expiry/JWKS; no fallback signing key |
| Unverified legacy Supabase-to-new account merge | Cross-user account or history takeover | Proof-based linking of old identity to new OIDC `(issuer,subject)`; **never email-only auto-link** |
| OIDC token assumed to prove E2EE device identity | Malicious device enrollment | Paired-device approval or authenticated step-up, device key pinning, revoked-device checks |
| Password-derived legacy private-key backup lost after auth cutover | Permanent loss of historical chat access | Explicit old-secret restore, independent recovery secret, fresh-device restore test before decommission |
| Privileged controller bypasses RLS | Cross-account queue/media access | Private SQL access, least-privilege roles and enforce account/device policy in application services |
| Self-hosted database or object-store compromise | Ciphertext and routing metadata disclosure | E2EE, scoped credentials, isolated networks, limited retention, encrypted operational backups |
| Misconfigured self-hosted IdP or signing-key rotation | Session spoofing or outage | Trusted issuer/JWKS lifecycle, MFA/CSRF protections, patching and recovery drills |
| Premature Supabase deletion or divergent dual-write | Message/key loss, split-brain accounts | Additive migration, read-only legacy rollback window, verified client-local history and backup recovery |
| Hostile frontend JavaScript after self-hosting | Endpoint/plaintext compromise | CSP/supply-chain protections, signed native app evaluation; self-hosting alone does not resolve it |

Server passwords, OAuth credentials and MFA secrets should remain inside the selected identity provider—not the messaging database. Web clients must never access PostgreSQL or internal S3 service credentials directly. The old Supabase RLS remains a **legacy audit concern**, not the target's only authorization layer.

See [Self-Hosted Backend and Supabase Exit](./15_Self_Hosted_Backend_and_Supabase_Exit.md).

## Out of scope for initial implementation

Anonymity against global network observers, compromised end-user devices, guaranteed deletion after recipient download, anti-screen-capture promises, protection against a fully compromised browser JavaScript origin, and sophisticated traffic analysis defenses.

## Current gaps to close first

The existing code uses server-retained messages, browser `localStorage` key export, a login-password-based backup key, direct trust of retrieved public keys, optional demo admin routes and a default JWT secret in the Express configuration. The tracked Supabase SQL migrations and current client query expectations also diverge. These are **unresolved**, not completed mitigations.

## Release gates

Run negative tests for account isolation/RLS, malicious directory key changes, fake ACK, replay and expiry, crypto-state crash recovery, attachment mutation and dangerous file previews, secret/default config rejection, and no plaintext leakage to backend/logs. Record a formal security review before claiming production readiness.
