# Whispr Server

This directory contains the Whispr backend service.

## Stack

- Node.js
- Express
- Socket.IO
- Zod
- Helmet
- CORS
- dotenv
- in-memory repository adapters
- Node test runner

## Purpose

The server is the routing and coordination layer for Whispr.

Its long-term responsibilities include:

- authentication and session handling
- public key distribution
- encrypted message relay
- ciphertext storage
- offline message synchronization
- delivery state updates

Under the project trust model, the server is not trusted with message confidentiality.

## Current State

The backend now implements the MVP service contracts:

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `PUT /me/public-key`
- `GET /users`
- `GET /users/:username/public-key`
- `GET /conversations/:peerUsername/messages`
- `POST /conversations/:peerUsername/messages`
- `POST /messages/:messageId/tamper` when demo tools are enabled

HTTP routes and Socket.IO connections are JWT-protected. The current persistence layer is in-memory behind repository interfaces, with a Postgres adapter stubbed for the next phase.

## Development

Install dependencies:

```bash
npm install
```

Start the server:

```bash
npm start
```

By default, the server listens on `http://localhost:4000`.

## Health Check

```bash
curl http://localhost:4000/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "Whispr Backend",
  "storageDriver": "memory"
}
```

## Environment Variables

The current server reads environment variables through `dotenv`.

Supported variables:

- `PORT`: optional port override
- `CLIENT_ORIGIN`: allowed browser origin for CORS and Socket.IO
- `JWT_SECRET`: signing secret for auth tokens
- `TOKEN_TTL_SECONDS`: auth token lifetime
- `ENABLE_DEMO_TOOLS`: enables ciphertext tamper route for the demo harness
- `STORAGE_DRIVER`: `memory` today, `postgres` reserved for the next adapter phase
- `DATABASE_URL`: Neon/Postgres connection string used when `STORAGE_DRIVER=postgres`
- `DISABLE_REALTIME`: disables Socket.IO broadcast path and expects polling/manual refresh instead

See `./.env.example` for a minimal example.

## Tests

Run the server integration test suite with:

```bash
npm test
```

## Development Notes

- Do not log plaintext messages, keys, or sensitive secrets.
- Keep request validation strict as endpoints are added.
- Preserve the zero-trust backend model.
- Update `../Docs/09_API_Design.md` and related docs when backend behavior changes.

## Related Docs

- `../README.md`
- `../CONTRIBUTING.md`
- `../Docs/README.md`
- `../Docs/04_System_Architecture.md`
- `../Docs/06_Threat_Model.md`
- `../Docs/09_API_Design.md`
