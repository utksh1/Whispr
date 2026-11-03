# Whispr — Project Overview

**Project:** Whispr (existing application; no separate versioned rewrite)

**Purpose:** Build a privacy-focused, end-to-end encrypted, **local-first** one-to-one messenger with secure offline delivery and encrypted attachments.

## Product model

Permanent conversation history lives on each authorized user's device in protected local storage. The service authenticates accounts, distributes public device-key material, relays **temporary encrypted message envelopes**, stores temporary encrypted attachment blobs, and emits realtime wake-up notifications. It is **not** the permanent source of message history.

A receiver who is offline needs server-held encrypted envelopes until durable delivery or expiry. A user losing every device and backup may lose history permanently; recovery is an explicit product feature, not an assumed server ability.

## Why this matters

TLS alone does not protect plaintext from a backend that processes it. E2EE moves message processing to the endpoints. Whispr additionally minimizes durable server content retention while preserving practical offline messaging, media transfer and recoverability.

## Target audience

People who value private communication, developers reviewing secure messaging designs, and security engineers evaluating realistic client, key-management and relay threat models.

## Explicit security limits

The relay still sees routing, timing, IP and payload-size metadata. A compromised key directory can attempt identity substitution unless clients verify keys. A hostile web app delivery origin or compromised endpoint can compromise plaintext despite E2EE. Whispr must not claim unconditional secrecy under all forms of server compromise.

## Implementation status

The current `/app` uses Next.js/Supabase Auth/PostgreSQL/Realtime and permanently retains encrypted messages on the server. Keys are currently exported in browser storage and backups are derived from the sign-in password. `/demo` is a separate Express/Socket.IO harness. Local encrypted history, ratcheting device sessions, temporary mailboxes, encrypted media pipelines and safe recovery described in the design docs are **planned**, not shipped.

## Direction

Keep the existing application and useful UI/auth/database infrastructure, then migrate incrementally: security hardening → canonical schema → local encrypted persistence → reviewed messaging protocol → mailbox delivery → encrypted media → device linking and recovery → verified legacy history migration.

Read [Architecture](./04_System_Architecture.md), [Threat Model](./06_Threat_Model.md), [Core Features](./03_Core_Features.md), and [Roadmap](./10_Development_Roadmap.md).
