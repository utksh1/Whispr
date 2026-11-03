# Whispr Server

Express/Socket.IO service used by the **`/demo`** route of the existing Whispr repository. The product `/app` currently talks directly to Supabase; the two paths are **not a single unified backend**.

## Implemented demo stack

Node.js, Express, Socket.IO, Zod, Helmet, CORS, dotenv and repository adapters for **filesystem** (configured default), **memory** and **PostgreSQL**. The PostgreSQL adapter contains schema/runtime issues and should not be assumed production-ready.

## Current routes

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/auth/register`, `/auth/login` | Demo account JWT issuance |
| GET | `/auth/me` | Authenticated account |
| PUT | `/me/public-key` | Active public key |
| PUT/GET | `/me/private-key-backup` | Legacy encrypted keyring backup |
| GET | `/users`, `/users/:username/public-key`, `/keys/:keyId` | Discovery and public key lookup |
| GET/POST | `/conversations/:peerUsername/messages` | Server-retained demo ciphertext history |
| POST | `/messages/:messageId/tamper` | **Demo-only** when enabled |

OpenAPI: `http://localhost:4000/openapi.json`; Swagger UI: `http://localhost:4000/docs`. Socket.IO uses JWT auth at handshake and broadcasts encrypted message events.

## Start for isolated development

```bash
npm install
cp .env.example .env
# Edit .env: set a strong unique JWT_SECRET, disable demo tools when not testing them
npm start
```

Health: `curl http://localhost:4000/health`.

**Warning:** `server/src/config.js` currently supplies a **predictable default `JWT_SECRET`** if unset; `server/.env.example` also has a placeholder secret and enables demo tools. Do **not** expose this server publicly until secrets are fail-closed and isolated demo capabilities are disabled.

Supported configuration includes `PORT`, `CLIENT_ORIGIN`, `JWT_SECRET`, `TOKEN_TTL_SECONDS`, `ENABLE_DEMO_TOOLS`, `STORAGE_DRIVER`, `STORAGE_PATH`, `DATABASE_URL` and `DISABLE_REALTIME`. Confirm exact behavior in `src/config.js`, not just the example file.

Tests:

```bash
npm test
```

Current automated tests do not establish secure end-to-end sessions, legacy Supabase RLS or new self-hosted API authorization and retention guarantees.

## Scalability and caching module contracts (TARGET / NOT IMPLEMENTED)

Initial production design: one modular backend with independently bounded identity/directory, durable mailbox, stateless realtime and encrypted-media authorization modules. PostgreSQL remains authoritative for pending encrypted envelopes, idempotency/ACK, device revocation and notification-outbox records.

**Optional Redis** provides ephemeral gateway routing/presence, allowlisted public metadata cache and isolated rate-limit counters; its outage cannot delete queued ciphertext or disable high-risk abuse protections. Realtime notifications are only hints; clients fetch mailbox state by authenticated cursor.

Support bounded connection/request/queue quotas, `429`/`503` backpressure, retention workers, attachment direct-to-private-object-storage flow, privacy-safe metrics and crash/reconnect/load tests. Defer sharding, partitioning and multi-region writers until actual throughput warrants them.

Read [Scalability and Caching](../Docs/13_Scalability_and_Caching.md) for proposed TTLs, SLO candidates and security/failure matrix.

## Self-hosted Whispr backend modules (TARGET / NOT IMPLEMENTED)

**New production responsibility:** Whispr owns all authenticated API/controller logic. The current Express server serves `/demo`; do **not** copy its predictable JWT-secret fallback or demo tampering/admin routes into production.

Target modules in `server/src/modules/`: `auth` (self-hosted OIDC verification and stable account mapping), `devices` (enrollment/revocation), `keys` (signed public bundles/prekeys), `mailbox` (pending encrypted envelope API, idempotent ACK), `realtime` (Socket.IO hints), `media` (authorized encrypted file capabilities), `recovery` (opaque E2EE backups). `workers` handle transactional notification outbox, mailbox expiry and media cleanup.

Target infrastructure: **private self-managed PostgreSQL** with `accounts`, verified `account_identities(issuer,subject)`, device/key tables, `delivery_keys` ledger, `pending_envelopes` ciphertext and `mailbox_events` outbox; self-hosted reviewed OIDC provider (Keycloak candidate), private S3-compatible storage and optional Redis. No target Supabase runtime and no direct browser DB access.

Use Docker Compose for isolated dev, TLS/secret isolation and restore drills for production. These modules/paths are **planned**, not in the current codebase. See [Self-Hosted Backend and Supabase Exit](../Docs/15_Self_Hosted_Backend_and_Supabase_Exit.md).

## Target role (planned, NOT implemented)

Evolve toward a self-hosted modular backend hosting authenticated device directory/key bundles, per-device encrypted mailboxes, ACK/expiration, Whispr-controlled Socket.IO wake-up and private S3-compatible ciphertext media APIs. Long-term chat history and decryption remain on endpoint devices. Keep or retire `/demo` behind explicit isolation; do not treat this design as a shipped API.

Do not add a permanent server-side messages archive to the target architecture or advertise browser-independent identity verification without client key pinning.

See [Architecture](../Docs/04_System_Architecture.md), [API](../Docs/09_API_Design.md), [Database](../Docs/08_Database_Design.md), [Roadmap](../Docs/10_Development_Roadmap.md).
