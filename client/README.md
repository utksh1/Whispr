# Whispr Client

Next.js App Router client for the **existing Whispr project**. The local-first architecture described in `../Docs/` is a **target**, not deployed behavior.

## Current routes

- `/`: product overview and navigation.
- `/app`: Supabase Auth, browser-side encryption, PostgreSQL encrypted-message history and Realtime.
- `/demo`: separate dual-lane demo using the Express/Socket.IO backend. It does **not** share the same account/session/storage path as `/app`.

Current `client/src/lib/crypto.js` uses P-256 ECDH, HKDF-SHA256 and AES-GCM. Local keyring exports are serialized into browser `localStorage`, and encrypted remote keyring backup currently derives from the sign-in password. These are **security issues to redesign**, not recommended patterns to copy.

## Run current client

```bash
npm install
npm run dev
```

The default local URL is `http://localhost:3000`.

## Current environment (LEGACY Supabase; current code only)

Create `client/.env.local` manually (**no tracked `client/.env.example`**):

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
NEXT_PUBLIC_SUPABASE_PROJECT_REF=your_project_ref
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Additional realtime/polling flags may be supported by the active source code; inspect configuration before enabling. Only public/publishable variables should have the `NEXT_PUBLIC_` prefix. Never put a service-role key there.

## Replacing Supabase in the client (TARGET / NOT IMPLEMENTED)

- Replace `client/src/lib/supabase.js` and browser-direct `supabase-chat.js` with a typed **Whispr API client**, a reviewed self-hosted OIDC login adapter, a protected local conversation store and encrypted outbox.
- New client requests must authenticate through Whispr-controlled API controllers; no direct PostgreSQL/PostgREST access and no internal S3 service credentials.
- Whispr Socket.IO `mailbox:available` events only wake devices to fetch pending envelopes. Persist cryptographic state and message locally **before ACK**; periodically refetch on reconnect, even when no hint arrived.
- Encrypted media uploads use temporary scoped capabilities from the Media Controller for a private S3-compatible store, not plaintext bytes via the messaging API.
- Existing users must recover their old password-derived keyring backups with the **old secret** and rekey them under an independent recovery secret before switching login providers. Account linking requires verified identity proof, not matching email.

The current `NEXT_PUBLIC_SUPABASE_*` configuration below is **only for maintaining or migrating legacy code**. Target Whispr API/OIDC settings are not implemented yet. See [Self-Hosted Backend and Supabase Exit](../Docs/15_Self_Hosted_Backend_and_Supabase_Exit.md).

## Vercel deployment and encrypted media toggle (TARGET)

The existing `client/` directory is the intended **Vercel project Root Directory**. Configure browser-public API/WebSocket and OIDC URLs only after corresponding code exists; **no DB password, IdP secret, R2 API credential or decryption key goes into `NEXT_PUBLIC_*`**. Whispr client-only chat storage/encryption must not move into Vercel SSR or shared caches.

**Text-only mode needs no R2/S3 configuration**. When encrypted attachments are implemented, the browser encrypts files locally and uploads/downloads ciphertext directly with short-lived, per-object capabilities from the Render Media Controller. Preferred store: **private Cloudflare R2**, with exact browser CORS origins and integrity checks. Do not assume arbitrary custom media domains work with R2 S3 presigned URLs. Keep an explicit media-disabled state and tested UI behavior when R2 is not configured.

See [Vercel + Render + Optional R2](../Docs/17_Render_Vercel_R2_Deployment.md).

## Target client modules (planned)

- Protected IndexedDB local chat repository and OPFS encrypted attachment cache.
- Device-scoped key manager and reviewed asynchronous E2EE session implementation.
- Crash-safe outbox/inbox, retry, replay detection and delivery ACK after local commit.
- Encrypted media engine with authenticated chunks and locally generated previews.
- Identity verification/safety numbers, explicit new-device pairing and recovery using a **separate** secret.
- Local-only search and accurate queued/accepted/delivered/read states.

A browser's local storage is vulnerable to loss/eviction and same-origin hostile JavaScript. A non-extractable key does not eliminate XSS risk; do not promise absolute endpoint secrecy.

## Client performance and caching (TARGET / NOT IMPLEMENTED)

The UI may keep a bounded in-memory cache of currently viewed decrypted messages and rendered thumbnails. The **encrypted IndexedDB chat repository is authoritative local history**, not a disposable cache of server records; OPFS is a candidate for encrypted attachment objects. Implement storage quota/eviction detection and recovery UX.

Offline outbox ciphertext and ratchet state must be transactionally recoverable. A lost websocket hint never means a missing message: fetch the durable pending mailbox on reconnect. Reuse envelope IDs and deduplicate redelivery. Do not place plaintext in HTTP/Service Worker caches, browser `localStorage`, shared CDN responses or network telemetry.

See [Scalability and Caching](../Docs/13_Scalability_and_Caching.md) for cache boundaries and client failure tests.

## Engineering notes

Run project tests/build commands from `client/package.json`. Test current and target behavior separately. Document any changed client protocol/storage contracts in [Architecture](../Docs/04_System_Architecture.md), [Crypto](../Docs/05_Cryptography_Security_Flow.md), and [API](../Docs/09_API_Design.md). No new `/v1` mailbox endpoint described in those documents is shipped yet.
