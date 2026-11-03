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

## Current environment

Create `client/.env.local` manually (**no tracked `client/.env.example`**):

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
NEXT_PUBLIC_SUPABASE_PROJECT_REF=your_project_ref
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Additional realtime/polling flags may be supported by the active source code; inspect configuration before enabling. Only public/publishable variables should have the `NEXT_PUBLIC_` prefix. Never put a service-role key there.

## Target client modules (planned)

- Protected IndexedDB local chat repository and OPFS encrypted attachment cache.
- Device-scoped key manager and reviewed asynchronous E2EE session implementation.
- Crash-safe outbox/inbox, retry, replay detection and delivery ACK after local commit.
- Encrypted media engine with authenticated chunks and locally generated previews.
- Identity verification/safety numbers, explicit new-device pairing and recovery using a **separate** secret.
- Local-only search and accurate queued/accepted/delivered/read states.

A browser's local storage is vulnerable to loss/eviction and same-origin hostile JavaScript. A non-extractable key does not eliminate XSS risk; do not promise absolute endpoint secrecy.

## Engineering notes

Run project tests/build commands from `client/package.json`. Test current and target behavior separately. Document any changed client protocol/storage contracts in [Architecture](../Docs/04_System_Architecture.md), [Crypto](../Docs/05_Cryptography_Security_Flow.md), and [API](../Docs/09_API_Design.md). No new `/v1` mailbox endpoint described in those documents is shipped yet.
