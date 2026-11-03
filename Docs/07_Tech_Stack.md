# Whispr — Tech Stack

> **Status:** Existing project, updated architecture direction. The "target" column is planning, **not** a list of installed dependencies.

| Area | Current repository | Target direction |
| --- | --- | --- |
| Product UI | Next.js App Router, React, TypeScript/JavaScript, Tailwind CSS | Retain UI stack; extract messaging/crypto/local persistence packages |
| User authentication | Supabase Auth for `/app`; separate Express JWT in `/demo` | Keep Supabase Auth for product; keep demo auth separate and isolated |
| Backend | Browser-direct Supabase access in product; Express/Socket.IO demo | Modular Node backend for delivery/media/key-directory logic, with well-tested Supabase integration |
| Realtime | Supabase Realtime (`/app`), Socket.IO (`/demo`) | Realtime as mailbox wake-up hint; HTTP/API as durable source of pending messages |
| Relational data | PostgreSQL/Supabase tables; separate Express repository adapters | PostgreSQL for identity metadata, device/prekey directory, **pending** envelopes and authorization |
| Chat history | Server-side ciphertext `messages` | Protected device-local message database; IndexedDB candidate for browser |
| Client media | No full encrypted attachment pipeline | OPFS/local media persistence; client-encrypted chunks in private Supabase Storage or S3-compatible object storage |
| Cryptography | Web Crypto P-256 ECDH + HKDF-SHA256 + AES-GCM | Reviewed authenticated ratcheting library, per-device sessions and key verification; evaluate support before choosing |
| Key storage | PKCS#8 exports serialized in browser `localStorage` | Key manager and encrypted local storage with explicitly assessed browser limitations |
| Backup | PBKDF2/AES-GCM using login password | Independent user-controlled recovery secret; memory-hard KDF where practical; versioned AEAD backup |
| Validation and tests | Express Zod, Node test runner, client tests | Contract schemas, integration/RLS tests, protocol vectors, browser E2E and failure injection |
| CI and operations | Current repository tooling; no verified full secure-message CI gate | GitHub Actions for security/integration gates; logs without plaintext, metrics without unnecessary metadata |

## Deployment principle

Begin with **one backend modular monolith**, PostgreSQL and private encrypted-object storage. Do not introduce Kafka, Redis, Kubernetes, Prisma, libsodium, MLS libraries or multiple independent services simply because they are listed as possible future technologies. Select each only after validating a concrete requirement.

## Browser vs native trust

A browser-based local database and Web Crypto keys improve local-first behavior, **not** immunity from XSS, malicious extensions or an attacker controlling delivered JavaScript. Consider a signed desktop/mobile client as a future hardening path after the web product architecture works.

## Related decisions

[System Architecture](./04_System_Architecture.md) · [Cryptography](./05_Cryptography_Security_Flow.md) · [Database](./08_Database_Design.md) · [Roadmap](./10_Development_Roadmap.md).
