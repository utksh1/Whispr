# Contributing to Whispr

Whispr remains **one existing repository and application**. We are evolving its system design in place toward local-first encrypted messaging, with no separate "2.0" project.

## Start here

Read the [root README](./README.md), [docs index](./Docs/README.md), [system architecture](./Docs/04_System_Architecture.md), [threat model](./Docs/06_Threat_Model.md) and [implementation roadmap](./Docs/10_Development_Roadmap.md). The docs distinguish **current implemented behavior** from the **planned target**; avoid presenting plans as completed security guarantees.

## Repository layout

| Path | Current role |
| --- | --- |
| `client/` | Next.js product `/app` using browser-direct Supabase, plus separate `/demo` UI |
| `server/` | Express/Socket.IO demo auth and repository-backed API |
| `server/supabase/migrations/` | Tracked Supabase schema evolution (currently inconsistent with some product queries) |
| `Docs/` | Canonical, in-place architecture, API, data, crypto, roadmap and demonstration documentation |

## Getting started

```bash
git clone https://github.com/utksh1/Whispr.git
cd Whispr
cd client && npm install && npm run dev
```

The client typically runs on `http://localhost:3000`. Configure `client/.env.local` manually; a `client/.env.example` file is **not** tracked. See [Supabase Setup](./Docs/10_Supabase_Setup.md).

For the **isolated demo API**, use another terminal:

```bash
cd server
npm install
cp .env.example .env
# Replace the JWT_SECRET placeholder; disable demo tools when not demonstrating
npm start
curl http://localhost:4000/health
```

`server/.env.example` exists. **The code currently falls back to a predictable JWT signing key if the environment variable is missing**; this must be fixed before a public release. Demo tamper/admin capabilities must not be exposed in production.

## Non-negotiable engineering principles

1. **Plaintext and private key safety:** never send chat/file plaintext or unencrypted recovery material to the server. No ordinary browser `localStorage` private-key exports in the target architecture.
2. **Local history, temporary relay:** the server may durably hold **pending ciphertext**, not a perpetual delivered-message archive.
3. **Strong identity:** authentication is not peer key verification. Treat directory substitution, key changes, revocation and device enrollment as threats.
4. **Reviewed crypto:** do not roll your own Double Ratchet. Make protocol choice, audit status, state persistence and test vectors explicit.
5. **Recoverable state:** commits must atomically preserve message/ratchet/outbox state; retry and ACK must be idempotent.
6. **Safe migration:** do not drop existing encrypted history; verify client import and recovery first.
7. **Data minimization:** least-privilege RLS, explicit TTL/retention, strict authorization on every mailbox/media operation.

## Validation

```bash
cd client
npm test
npm run lint
npm run build
```

```bash
cd server
npm test
```

These are **existing commands**, not proof that new crypto, mailbox or Supabase RLS integration tests already exist. Document anything you cannot run. For changes to the target architecture, add failure and negative-security tests covering authorization, network loss, duplicate/replayed envelopes, corrupted media, browser eviction, failed backup recovery and unexpected key changes.

## Pull requests

Use descriptive branches and limited-scope PRs. Include:

- What is current, what changes now, and what remains planned.
- Threat model and backward-compatibility impact.
- Clear API/schema/protocol changes and migration steps.
- Test commands, outcomes and any skipped gates.
- Relevant updates to **existing** `Docs/` and service READMEs.

Do not silently change crypto, key derivation, device-identity semantics or production retention. Changes to auth, media, backend storage or client state require review of [Cryptography](./Docs/05_Cryptography_Security_Flow.md), [Data Design](./Docs/08_Database_Design.md), and [API Design](./Docs/09_API_Design.md).

## Security disclosures

Do not post exploitable security issues with sensitive details in public issues. Contact the repository maintainers through an established private channel. Do not share credentials, private keys, production ciphertext or personally identifiable data in PRs.

## Review priorities

First focus on strong secrets and privileged-route isolation, canonical migrations/RLS, key lifecycle protection and reliable local data persistence. Defer groups/calling and distributed infrastructure until one-to-one encrypted messaging and offline media transfer pass security gates.

Be respectful and evidence-driven in review discussions.
