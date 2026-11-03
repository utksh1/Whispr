# Whispr — Cryptography and Key Lifecycle

> **Status:** Architecture target for the existing Whispr project; **not yet implemented**. This document distinguishes current source code from the desired protocol. All security claims depend on the client delivery and endpoint threat model below.

## Current implementation (verified in source)

`client/src/lib/crypto.js` uses browser **P-256 ECDH**, **HKDF-SHA256**, and **AES-GCM** with per-message salt, random nonce and authenticated associated data containing sender/recipient public keys and version. The keyring exports PKCS#8 private keys and serializes them into `localStorage`. A remotely stored backup encrypts the serialized keyring with AES-GCM after **PBKDF2-SHA256 (150,000 iterations)** derived from the sign-in password supplied to Supabase Auth.

Those are implementation facts, **not** proof of forward secrecy, verified correspondent identity or safe key isolation. The current message design uses long-lived ECDH identities and lacks Double Ratchet/session management. Decryption authentication verifies ciphertext and AAD under a key, **not** that the key belongs to the human the UI claims.

## Target protocol decision

Use a **reviewed, actively maintained implementation** of authenticated asynchronous session initiation and a **Double Ratchet-style** per-device protocol for one-to-one messages. Determine platform/library support, audit history, licensing, wire interoperability, state persistence guarantees and test vectors before choosing a specific library. Never invent a new E2EE protocol from cryptographic primitives.

Required security properties:

- Peer-identity binding with safety numbers/fingerprints, QR verification and conspicuous key-change warnings.
- Forward secrecy through message-key evolution; bounded post-compromise recovery where the chosen ratchet supports it, subject to correct device-state handling.
- Independent sessions per device, fresh nonces/keys as required by the selected protocol, replay detection and bounded out-of-order processing.
- Authenticated versioned protocol envelopes and canonical associated-data encoding binding message type, session/device identifiers and routing context as appropriate.
- Transaction-safe ratchet state + message/outbox persistence; restore after crashes without nonce reuse or state rollback.
- Explicit revocation, device list changes, recovery and missing-key behavior.

For prospective group messaging, evaluate **Messaging Layer Security (MLS; RFC 9420)** as a *separate* phase, not as a change hidden inside one-to-one implementation.

## Target one-to-one flow

```mermaid
sequenceDiagram
  participant A as Alice's device
  participant D as Untrusted key directory
  participant Q as Encrypted mailbox
  participant B as Bob's device
  A->>D: Fetch device list + authenticated key bundles
  D-->>A: Device bundles and verification data
  A->>A: Verify identity/change policy; establish session
  A->>A: Ratchet-encrypt; commit state + local outbox
  A->>Q: Store versioned ciphertext envelope per device
  Q-->>A: Accepted / expiry metadata
  Q-->>B: Wake-up hint (optional)
  B->>Q: Authenticated fetch
  Q-->>B: Ciphertext envelope
  B->>B: Authenticate, decrypt, dedupe, persist atomically
  B->>Q: ACK only after durable save
  Q->>Q: Delete acknowledged envelope
```

The untrusted directory can substitute keys unless the client pins/validates identity bindings and exposes key changes. A successfully decrypting message is not automatically a verified sender.

## Private keys and local storage

- **Target:** keep active private cryptographic material under a key-management boundary, with non-extractable Web Crypto keys where compatible and safe persistence in IndexedDB/OPFS for encrypted records. Assess browser storage eviction, backups and support across browsers.
- Non-extractability does **not** defend against all XSS: same-origin malicious JavaScript can call cryptographic operations. Enforce CSP, strict dependency control and careful rendering; consider signed native apps as a stronger future security target.
- Export private key material only for **explicit encrypted backup or device transfer** with a user-controlled recovery secret, not the user's account login password.
- Account authentication establishes API authorization; it must not be confused with verification of a messaging identity.

## Backups

A backup must be end-to-end encrypted **before upload**, authenticated and versioned. Use a separate high-entropy recovery key or independently chosen passphrase with a modern memory-hard KDF suitable for the client platform. Store only ciphertext, KDF parameters, salt, nonce, version and rollback-protection metadata server-side. A failed decrypt must **not** generate and auto-upload a replacement backup. Provide verification, recovery testing, export and explicit reset confirmations.

## Encrypted media

Generate independent random file key material client-side. Encrypt file chunks and a manifest with authenticated encryption, per-chunk unique nonce construction, authenticated ordering/index binding, final integrity verification and size/format caps. The E2EE chat envelope carries the wrapped key and opaque object reference; the object store never receives decryption material. Media previews are produced locally; never let the server derive thumbnails from plaintext.

## Cryptographic cache boundaries and distributed delivery (TARGET)

Signed public device-key bundles may be cached **briefly** for directory performance, but the client still verifies the identity binding, pinned fingerprint, key version and revocation/rotation policy. A Redis hit must never change an unverified directory key into a verified human identity. Cached authorization must not allow a revoked device to continue fetching envelopes.

Do **not** cache plaintext messages, private/ratchet keys, session bearer tokens, backup secrets or decrypted media in Redis, shared HTTP/Service Worker caches, CDNs or generic backend logs. Client-side RAM may temporarily hold decrypted active-view data; the protected local database is durable endpoint history, not an evictable remote cache.

Redis Pub/Sub and realtime delivery are merely wake-up hints. The authenticated client must fetch pending ciphertext from PostgreSQL-backed mailboxes after reconnect. Duplicate/reordered delivery must not roll back ratchet state or cause key/nonce reuse. Media CDN objects, if deployed, contain **ciphertext only** and are accessible through validated short-lived capabilities; decryption material arrives via an independent E2EE envelope.

See [Scalability and Caching](./13_Scalability_and_Caching.md).

## Auth and E2EE separation after Supabase removal (TARGET)

Moving from Supabase Auth to a **self-hosted standards-based OIDC identity provider** does **not** change the fundamental E2EE rule: the authentication provider knows the account but must **never** know the plaintext device private key, ratchet state, attachment key or recovery secret. Whispr Auth Controllers validate OIDC tokens and map verified issuer/subject identities to local accounts, while independent device-enrollment verification, identity pins, signed public bundles and safety numbers bind cryptographic peers.

**Migration warning:** the legacy browser encrypts private-key backups using a key derived from the Supabase sign-in password. Changing credentials or switching OAuth/login providers will not automatically restore those keys. Recover with the old secret, test a fresh-device restore and explicitly re-encrypt using a separate recovery secret *before* removing legacy Auth. Failed recovery must not overwrite remote backup state.

Self-hosting an identity provider, Node controllers or object storage does not eliminate hostile-JavaScript/endpoint compromise or server-controlled directory-key substitution. See [Self-Hosted Backend and Supabase Exit](./15_Self_Hosted_Backend_and_Supabase_Exit.md).

## Security boundaries and honest claims

- A **database-only** breach should expose ciphertext and limited metadata, assuming strong local key security.
- A hostile **backend key directory** threatens identity and message integrity unless clients verify bindings.
- A fully compromised **web hosting origin** can serve hostile JavaScript and steal plaintext or issue key operations. Do **not** claim a browser-only app guarantees secrecy against complete frontend/server compromise.
- A compromised endpoint, malicious extensions, forgotten recovery secret, and copied recipient plaintext cannot be solved by transport E2EE alone.

References: [Signal protocol specifications](https://signal.org/docs/), [MLS RFC 9420](https://www.rfc-editor.org/rfc/rfc9420), [Threat Model](./06_Threat_Model.md). No production cryptographic assurance is claimed until implementation, test vectors and external review.
