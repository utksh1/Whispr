# Whispr Client

This directory contains the public Whispr frontend built with Next.js App Router.

## Current Surfaces

- `/` overview and route selection
- `/app` authenticated single-user chat flow
- `/demo` dual-client judge demo harness

Both surfaces share the same browser crypto helpers, authenticated API client, and realtime socket flow.

## Development

Install dependencies:

```bash
npm install
```

Start the client:

```bash
npm run dev
```

The client runs on `http://localhost:3000` by default.

## Environment

The client expects:

- `NEXT_PUBLIC_API_URL`: backend base URL, for example `http://localhost:4000`

See `./.env.example` for the default local setup.

## Notes

- Private keys stay in browser storage for this MVP.
- Plaintext should never be sent to the backend.
- The production build is verified with `npx next build --webpack` in this environment because Turbopack is sandbox-limited here.
