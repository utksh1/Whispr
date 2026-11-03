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

## Future acceptance demo (PLANNED)

The same Whispr product should later demonstrate:

- Sender queues locally while recipient is offline; the backend holds only a temporary E2EE envelope.
- Receiver reconnects, verifies keys, durably stores/decrypts and ACKs.
- Relay removes pending ciphertext after ACK; local chat remains readable.
- Encrypted image/document upload shows ciphertext in temporary object storage, with keys delivered only inside E2EE message.
- A replayed envelope is deduplicated; a substituted identity key triggers a user warning; backup failure never destroys an existing keyring.
- A lost device without a configured recovery method demonstrates the **real** risk of lost local history.

## Evidence and release criteria

Current demo tests cannot stand in for actual cryptographic protocol audits, browser E2E tests, RLS-negative tests or proper key recovery validation. Do not demonstrate a planned feature as though already released.

See [Architecture](./04_System_Architecture.md), [Security Flow](./05_Cryptography_Security_Flow.md), [Roadmap](./10_Development_Roadmap.md).
