# Whispr — Demo Flow

> **Purpose:** Demonstrate **current** authenticated encrypted-chat behavior and its security limitations. Planned local-first functionality is **not** yet part of the demo. This is the same Whispr application, not a separate product version.

## Current demo setup

- Open `/demo` for the Express/Socket.IO two-client harness.
- Configure `server/.env` with a unique secret, set `ENABLE_DEMO_TOOLS=true` **only in an isolated local demonstration** and keep the demo service off public networks.
- `/app` is a different Supabase Auth/Postgres path; showing `/demo` does **not** prove that `/app` has equivalent authentication, storage or RLS properties.

## Current walkthrough

1. Open the two browser lanes, register/login Alice and Bob with **test accounts**.
2. Generate or restore their browser keys, and show the client encrypting text before it submits ciphertext to the demo backend.
3. Inspect the demo backend view. It should show ciphertext/nonce/metadata rather than plaintext. **Do not suggest this proves absence of metadata leakage or protection from compromised browser JavaScript.**
4. Observe the recipient decrypting locally. Note that successful AES-GCM decryption authenticates the payload *under its key*, **not** that an unverified directory key belongs to the human recipient/sender.
5. In the isolated demo only, use tamper tooling to corrupt ciphertext and show authenticated decryption failure.
6. Inspect browser storage carefully: the current keyring exports private key material into `localStorage`; do **not** claim the current browser keyring is non-extractable or fully protected from XSS.

## Demo security rules

**Never** enable public privileged `/api/admin` routes or deploy tamper/admin demo features as a production capability. Current privileged Next.js admin routes are missing normal authorization checks; fix/isolate them before any public deployment. Avoid real user accounts or production message history in demos.

## Self-hosted migration demonstration (PLANNED, NOT AVAILABLE)

A release-readiness demo should use a reviewed self-hosted OIDC provider, Whispr Auth/Device/Mailbox/Media controllers and private PostgreSQL/object storage rather than Supabase or the demo JWT issuer. Demonstrate proof-based legacy account linking, old-password-derived keyring backup restoration/rekey, new-device pairing and client-local encrypted history import. Simulate a revoked device, Redis outage, ciphertext expiry and object-store failure.

**The present `/demo` does not prove any of these capabilities**; it remains a separate legacy harness. See [Self-Hosted Backend and Supabase Exit](./15_Self_Hosted_Backend_and_Supabase_Exit.md).

## Future acceptance demo (PLANNED)

The same Whispr product should later demonstrate:

- Sender queues locally while recipient is offline; the backend holds only a temporary E2EE envelope.
- Receiver reconnects, verifies keys, durably stores/decrypts and ACKs.
- Relay removes pending ciphertext after ACK; local chat remains readable.
- Encrypted image/document upload shows ciphertext in temporary object storage, with keys delivered only inside E2EE message.
- A replayed envelope is deduplicated; a substituted identity key triggers a user warning; backup failure never destroys an existing keyring.
- A lost device without a configured recovery method demonstrates the **real** risk of lost local history.

## Future scalability demonstration (PLANNED, not in current demo)

A release-readiness demo should show an offline recipient, durable PostgreSQL envelope persistence, and recovery after the realtime gateway/Redis is restarted. The recipient reconnects and fetches ciphertext even if the wake-up hint was lost, commits locally, ACKs, and the pending server envelope disappears without removing the recipient's local chat.

Additional exercises: repeated sender retries create one logical message; stale directory/device cache cannot bypass revoked-device authorization; rate limits still enforce conservative behavior if shared cache fails; authenticated encrypted media remains downloadable through scoped object-storage capabilities; abuse/backpressure returns retryable failures rather than a false `accepted` status.

These are **future integration tests**, not current proof from `/demo`. See [Scalability and Caching](./13_Scalability_and_Caching.md).

## Future Vercel + Render deployment acceptance (PLANNED)

Demonstrate the same Whispr app on **Vercel `client/` + Render `server/` + paid PostgreSQL**, with verified OIDC. First send/receive **text-only encrypted messages with no R2/S3 credentials**, recovering after Render WebSocket restarts. Later enable client-encrypted media using a **private Cloudflare R2 bucket** and prove expired signed URLs, wrong-device access and malformed ciphertext are rejected. This is planned, not supported by the current `/demo` path.

See [Vercel + Render + Optional R2](./17_Render_Vercel_R2_Deployment.md).

## Evidence and release criteria

Current demo tests cannot stand in for actual cryptographic protocol audits, browser E2E tests, RLS-negative tests or proper key recovery validation. Do not demonstrate a planned feature as though already released.

See [Architecture](./04_System_Architecture.md), [Security Flow](./05_Cryptography_Security_Flow.md), [Roadmap](./10_Development_Roadmap.md).
