# Contributing to Whispr

Thanks for contributing to Whispr.

Whispr is a privacy-focused messaging project built around a zero-trust backend model. Contributions should preserve that core principle: the server may route and store data, but it must not be able to read message plaintext.

## Project Status

This repository is still in an early implementation stage.

- The `client/` app is a Next.js application.
- The `server/` app is an Express and Socket.IO service with a health endpoint and realtime server bootstrapping.
- The `Docs/` directory captures the intended architecture, security model, API direction, and roadmap.

Contributors should treat the docs as design intent, not as proof that every feature is already implemented.

## Repository Layout

- `client/`: frontend application built with Next.js, React, TypeScript, and Tailwind CSS.
- `server/`: backend service built with Express, Socket.IO, Zod, Helmet, and CORS.
- `Docs/`: architecture, security, API, database, roadmap, demo, and pitch documentation.
- `README.md`: project overview and navigation entry point.

Service-specific notes live in:

- `client/README.md`
- `server/README.md`
- `Docs/README.md`

## Prerequisites

- Node.js 18 or newer
- npm
- Git

## Local Development

### 1. Clone the repository

```bash
git clone https://github.com/utksh1/Whispr.git
cd Whispr
```

### 2. Install client dependencies

```bash
cd client
npm install
```

### 3. Start the client

```bash
npm run dev
```

By default, the client runs on `http://localhost:3000`.

### 4. Install server dependencies

```bash
cd ../server
npm install
```

### 5. Start the server

```bash
node index.js
```

By default, the server runs on `http://localhost:4000`.

### 6. Verify the backend is running

Open `http://localhost:4000/health`.

Expected response:

```json
{
  "status": "ok",
  "service": "Whispr Backend"
}
```

## Environment Configuration

The current server code reads environment variables through `dotenv` and uses `PORT` when provided.

- Do not commit secrets, API keys, credentials, or private keys.
- Keep local environment files untracked.
- If you introduce a new required environment variable, document it in the relevant README and update this file.

## Development Principles

- Preserve the zero-trust backend model.
- Keep plaintext, private keys, and decrypted content off the server.
- Prefer minimal, reviewable pull requests.
- Update documentation when behavior, architecture, or security assumptions change.
- Be explicit about tradeoffs when changing crypto, auth, transport, or storage flows.

## Coding Expectations

### Frontend

- Use TypeScript.
- Follow the existing Next.js and React structure.
- Keep UI changes aligned with the security and product goals described in `Docs/`.

### Backend

- Validate request payloads strictly.
- Avoid logging sensitive data.
- Keep security middleware enabled unless there is a documented reason to change it.

### Security-sensitive changes

Changes involving any of the following should include documentation updates:

- cryptographic primitives
- key lifecycle
- message payload structure
- authentication flows
- database storage of security-related fields
- threat model assumptions

Relevant docs live in:

- `Docs/04_System_Architecture.md`
- `Docs/05_Cryptography_Security_Flow.md`
- `Docs/06_Threat_Model.md`
- `Docs/08_Database_Design.md`
- `Docs/09_API_Design.md`

## Validation Before Opening a Pull Request

Run the checks that exist for the area you changed.

### Client

```bash
cd client
npm run lint
npm run build
```

### Server

The server does not yet define a real automated test script.

At minimum:

- start the server locally
- confirm `GET /health` responds successfully
- verify any changed endpoints or realtime behavior manually

If you add server scripts for testing, linting, or running in development mode, update this guide.

## Branch Naming

Use short, descriptive branch names.

Examples:

- `feat/client-chat-shell`
- `fix/socket-reconnect`
- `docs/api-cleanup`
- `security/payload-validation`

## Commit Guidance

- Keep commits focused.
- Use clear messages that describe intent.
- Prefer messages such as `add healthcheck docs`, `fix message schema validation`, or `update threat model for replay protection`.

## Pull Request Expectations

Each pull request should include:

- a concise summary of the change
- the reason for the change
- testing or verification notes
- screenshots for UI changes when relevant
- linked issue or context when applicable
- documentation updates for architecture, security, or workflow changes

Avoid mixing unrelated refactors with feature work.

## Documentation Contributions

Documentation is part of the product and security story.

- Keep docs consistent with the actual codebase.
- Mark future or planned behavior clearly instead of presenting it as implemented.
- Prefer precise wording over marketing language in implementation docs.
- When updating APIs, data models, or security assumptions, update the matching file in `Docs/`.

## Reporting Security Issues

Do not open a public issue for a suspected vulnerability.

Instead, contact the maintainers privately through the repository owner or the project contact path listed on GitHub. Include:

- a clear description of the issue
- impact assessment
- reproduction steps if safe to share
- proposed mitigation if available

## Good First Contributions

Useful early contributions include:

- improving validation and error handling
- strengthening documentation consistency
- adding missing scripts for local development
- improving health checks and local setup
- tightening API contracts and request schemas
- replacing placeholders with production-ready project guidance

## Out of Scope for Casual Changes

Coordinate larger changes before implementing them if they significantly alter:

- the cryptographic design
- the trust model
- key management strategy
- storage model for messages or devices
- authentication architecture

## Code of Conduct

Be respectful, direct, and constructive in project discussions and reviews.
