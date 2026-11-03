# Whispr Documentation

These are the **existing project's canonical design docs**, updated in place to guide the local-first redesign. **There is no separate "2.0" version or docs directory.** Changes are incremental and must preserve safe migration of existing user data.

## Status language

- **Current / as-is:** behavior verified in the repository today.
- **Target / proposed:** design decision or planned work; **not implemented**.
- **Release gate:** validation required before declaring that capability production-ready.

At present, `/app` is a browser-direct Supabase encrypted-chat prototype with retained server ciphertext; `/demo` is a different Express/Socket.IO harness. The target is encrypted local conversation history, temporary per-device pending delivery, reviewed session cryptography, authenticated identity verification and client-encrypted attachments.

## Document index

| Document | Purpose |
| --- | --- |
| [01 — Project Overview](./01_Project_Overview.md) | Product vision, accurate limits and transition |
| [02 — Problem Statement](./02_Problem_Statement.md) | Security/privacy outcomes and success criteria |
| [03 — Core Features](./03_Core_Features.md) | P0/P1/P2 feature backlog, user promises and non-guarantees |
| [04 — System Architecture](./04_System_Architecture.md) | Trust boundaries, local-first data flow, mailbox/media responsibilities |
| [05 — Cryptography](./05_Cryptography_Security_Flow.md) | Current crypto vs reviewed protocol target, identity and backup lifecycle |
| [06 — Threat Model](./06_Threat_Model.md) | Assets, attackers, browser/server limitations and release gates |
| [07 — Tech Stack](./07_Tech_Stack.md) | Retained components vs prospective replacements |
| [08 — Database Design](./08_Database_Design.md) | Current schema drift, server pending mailbox and local encrypted data |
| [09 — API Design](./09_API_Design.md) | Existing APIs and explicitly proposed versioned mailbox/media contracts |
| [10 — Development Roadmap](./10_Development_Roadmap.md) | Ordered PR work and validation gates |
| [Supabase Setup](./10_Supabase_Setup.md) | Current auth, tracked SQL and safe target migration |
| [11 — Demo Flow](./11_Demo_Flow.md) | Isolated demo and honest security demonstration |
| [12 — Pitch Notes](./12_Pitch_Notes.md) | Claims grounded in current and intended capabilities |
| [13 — Scalability and Caching](./13_Scalability_and_Caching.md) | Cache hierarchy, Redis, gateway and mailbox scale, CDN security, TTL, SLO and failure matrix |

## Scalability and caching reference

[**13 — Scalability and Caching**](./13_Scalability_and_Caching.md) is part of this **same Whispr documentation tree**. It specifies the logical control/delivery/media planes, PostgreSQL mailbox authority, Redis presence and safe metadata caching, client-local encrypted storage, media/CDN caching, idempotency/ACK failure recovery, backpressure, optional regional routing and measurable performance goals. All proposed cache TTLs/SLOs are **unimplemented design candidates**.

## Optimized physical database design

[**14 — Optimized Database Design**](./14_Optimized_Database_Design.md) refines the target schema: normalized device identities and key bundles, pending ciphertext separated from small delivery/ACK idempotency tombstones, transactional event outbox, minimal media-object metadata, targeted per-device and expiry indexes, transactional client-local records, migration gates and realistic partitioning criteria. Example SQL is **design-only**, not an applied Supabase migration.

## Core decisions

1. **Client-owned history:** protect messages in device-local storage; server retains only encrypted undelivered envelopes and temporary encrypted blobs.
2. **Durable asynchronous transport:** queues, idempotent send, retry, per-device ACK *after local persistence*, expiry and reconnect handling.
3. **Verified identity and reviewed protocol:** current AES-GCM ciphertext authentication is not proof of correspondent identity; avoid custom ratcheting protocols.
4. **Separate recovery:** account password is not a backup decryption key; encrypt before upload and require explicit recovery UX.
5. **Incremental migration:** reconcile real schema and preserve legacy ciphertext until imported/verified; no rewrite of the entire product on a separate branch.

## Documentation update policy

Update architecture, threat model, schema, API, client/server READMEs and tests together when behavior changes. Replace "target" labels only after code + negative security tests demonstrate a feature. Never describe proposed `/v1` endpoints as deployed. Keep historical docs for the demo honest about its distinct backend, insecure defaults and demonstration-only routes.

## Before editing implementation

Read [Architecture](./04_System_Architecture.md) → [Threat Model](./06_Threat_Model.md) → [Data Design](./08_Database_Design.md) → [API Design](./09_API_Design.md) → [Roadmap](./10_Development_Roadmap.md). Document any unresolved decisions as ADRs **inside the existing docs tree when actually needed**; do not generate parallel version trees.
