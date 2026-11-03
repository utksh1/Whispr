# Whispr — Pitch Notes

> Presentation narrative, **not** implementation or security certification. Whispr is being redesigned **in the existing project**; there is no separate 2.0 release.

## Elevator pitch

Whispr is an end-to-end encrypted messaging project built to minimize the amount of conversation content the backend can retain. The current prototype encrypts client-side; the target product will keep long-term chat history on devices and use server storage only for temporary encrypted delivery and encrypted attachments.

## Problem

Transport encryption does not by itself prevent server operators or attackers from seeing application plaintext. A centralized archive also increases retention and metadata exposure. Private messaging needs secure identity verification, key handling, offline delivery and recoverability.

## Current proof of concept

Whispr includes a Next.js/Supabase product route and a separate Express/Socket.IO two-user demo. Encryption uses browser P-256 ECDH, HKDF-SHA256 and AES-GCM. Current server-side ciphertext history, browser key export, login-password-based encrypted backup and missing full key verification mean it **cannot yet promise production-grade secure messaging**.

## Target platform ownership (NOT SHIPPED)

Whispr's planned infrastructure is **self-hosted**: Whispr-owned controllers, a maintained standards-based OIDC identity provider, private PostgreSQL, Socket.IO and private S3-compatible ciphertext storage, with optional Redis. The current `/app` still uses Supabase and the `/demo` backend has a different auth path. Self-hosting adds control **and operational obligations**, not unconditional protection from malicious JavaScript or compromised endpoints.

The migration has specific identity-verification, private-key-backup recovery, local history import and decommission gates. Refer to [Self-Hosted Backend and Supabase Exit](./15_Self_Hosted_Backend_and_Supabase_Exit.md).

## Target differentiation (NOT shipped)

- Device-owned encrypted chat history and local-only search.
- Temporary per-device encrypted mailboxes that delete after durable ACK or expiry.
- Audited/reviewed ratcheting one-to-one encryption, user-visible key verification and per-device management.
- Client-encrypted file/image/video transfer with short-lived ciphertext storage.
- User-controlled recovery independent of login credentials.
- Explicit privacy limits for server metadata, hostile web-origin scripts and compromised devices.

## Scalability story (TARGET; not an observed benchmark)

Whispr is designed so chat history remains local while an authoritative pending ciphertext mailbox supports offline devices. Stateless realtime gateways can be scaled independently; Redis may improve ephemeral presence/routing and permitted metadata reads but cannot become the message source of truth. File bytes move as client-encrypted chunks through private object storage rather than overloading the messaging API. A single modular backend is deliberately preferred before distributed infrastructure.

Do not advertise throughput, latency, global availability, Redis, CDN or multi-region capability as **implemented or measured** until deployment and tests support the claim. The detailed plan is [Scalability and Caching](./13_Scalability_and_Caching.md).

## A grounded closing line

"Whispr is moving from encrypted chat as a feature toward a local-first secure-messaging architecture where the server delivers encrypted data but is not the permanent home of conversations."

## Demo guidance

Describe **existing** behavior separately from the **target** and never equate "ciphertext visible in admin" with proof against all server compromise. The threat model and protocol still require implementation and review.

Related: [Core Features](./03_Core_Features.md), [Threat Model](./06_Threat_Model.md), [Demo Flow](./11_Demo_Flow.md).
