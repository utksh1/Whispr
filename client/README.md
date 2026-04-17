# Whispr Client

This directory contains the Whispr frontend application.

## Stack

- Next.js
- React
- TypeScript
- Tailwind CSS

## Purpose

The client is responsible for the user-facing messaging experience and, over time, will hold the security-critical logic that belongs on trusted user devices:

- authentication flows
- key generation and local key handling
- message encryption before transmission
- message decryption after receipt
- integrity and authenticity checks in the UI flow

## Development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Run lint checks:

```bash
npm run lint
```

Create a production build:

```bash
npm run build
```

The app runs on `http://localhost:3000` by default.

## Current State

This app is in an early stage. Some architecture and security behavior described in the root `Docs/` directory reflects intended design, not fully completed implementation.

When making client changes:

- keep security-sensitive logic on the client side
- avoid introducing flows that move plaintext or private keys to the backend
- update the matching docs when implementation decisions become concrete

## Related Docs

- `../README.md`
- `../Docs/04_System_Architecture.md`
- `../Docs/05_Cryptography_Security_Flow.md`
- `../Docs/09_API_Design.md`
