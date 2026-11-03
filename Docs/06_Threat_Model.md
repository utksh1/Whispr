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

## Out of scope for initial implementation

Anonymity against global network observers, compromised end-user devices, guaranteed deletion after recipient download, anti-screen-capture promises, protection against a fully compromised browser JavaScript origin, and sophisticated traffic analysis defenses.

## Current gaps to close first

The existing code uses server-retained messages, browser `localStorage` key export, a login-password-based backup key, direct trust of retrieved public keys, optional demo admin routes and a default JWT secret in the Express configuration. The tracked Supabase SQL migrations and current client query expectations also diverge. These are **unresolved**, not completed mitigations.

## Release gates

Run negative tests for account isolation/RLS, malicious directory key changes, fake ACK, replay and expiry, crypto-state crash recovery, attachment mutation and dangerous file previews, secret/default config rejection, and no plaintext leakage to backend/logs. Record a formal security review before claiming production readiness.
