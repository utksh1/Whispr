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

The backend is currently early-stage.

The existing codebase includes:

- Express app bootstrapping
- security middleware setup
- Socket.IO server initialization
- a `GET /health` endpoint

The fuller API and storage model described in `../Docs/` should be treated as target design until implemented.

## Development

Install dependencies:

```bash
npm install
```

Start the server:

```bash
node index.js
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
  "service": "Whispr Backend"
}
```

## Environment Variables

The current server reads environment variables through `dotenv`.

Supported variable today:

- `PORT`: optional port override for the HTTP and Socket.IO server

See `./.env.example` for a minimal example.

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
