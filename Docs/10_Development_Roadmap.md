# Whispr — Development Roadmap

## Phase 1 — Foundation
- finalize project scope
- define threat model
- set up frontend and backend repositories
- configure database and authentication

## Phase 2 — Core Security
- generate client keypairs
- upload and store public keys
- build message encryption flow
- build message decryption flow

## Phase 3 — Messaging
- create one-to-one conversations
- send encrypted messages
- store ciphertext in database
- fetch and decrypt messages on client

## Phase 4 — Realtime Experience
- add WebSocket / Socket.IO messaging
- handle online and offline delivery
- add delivery status updates

## Phase 5 — Hardening
- input validation
- secure secret storage
- rate limiting
- audit basic logs
- reduce sensitive metadata exposure

## Phase 6 — Demo Prep
- create architecture diagram
- create threat model slide
- prepare compromised-backend demonstration
- test full workflow end to end

## Hackathon MVP
If time is limited, finish these first:
1. signup/login
2. key generation
3. encrypted one-to-one chat
4. ciphertext-only storage
5. server-compromise demo
