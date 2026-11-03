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

Current automated tests do not establish secure end-to-end cryptographic sessions, real Supabase RLS or production retention guarantees.

## Target role (planned, NOT implemented)

Evolve toward a modular backend hosting device directory/key bundles, authenticated pending **per-device encrypted mailboxes**, ACK/expiration, realtime wake-up and private ciphertext media object APIs. Long-term chat history and decryption remain on endpoint devices. Keep or retire `/demo` behind explicit isolation; do not treat this design as a shipped API.

Do not add a permanent server-side messages archive to the target architecture or advertise browser-independent identity verification without client key pinning.

See [Architecture](../Docs/04_System_Architecture.md), [API](../Docs/09_API_Design.md), [Database](../Docs/08_Database_Design.md), [Roadmap](../Docs/10_Development_Roadmap.md).
