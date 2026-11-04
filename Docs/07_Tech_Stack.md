# Whispr — Tech Stack

> **Status:** The current repository still uses Supabase in `/app`. The **target architecture is fully self-hosted under Whispr's control**. This is a design change in the existing project, **not** a new "2.0" release; dependencies and services described as target are not installed/deployed yet.

## Current implementation vs target

| Concern | Current code (as-is) | Target architecture (NOT IMPLEMENTED) |
| --- | --- | --- |
| Product web UI | Next.js / React, Tailwind; JS/TS | Keep Next.js/React; separate E2EE client, authenticated API, local DB and media modules |
| Authentication | Supabase Auth (`/app`) and separate Express demo JWT (`/demo`) | **Self-hosted standards-based OIDC IdP** (Keycloak is an evaluated candidate); Whispr Auth Controller verifies trusted issuer/audience/JWKS and maps IDs |
| Backend | Browser-direct Supabase data/auth and separate Express/Socket.IO demo backend | **Whispr-owned Node.js + TypeScript modular monolith** with controllers/services/policies/repositories/workers; reuse hardened Express pieces |
| Realtime | Supabase Realtime (`/app`); Socket.IO (`/demo`) | Whispr-owned Socket.IO/WebSocket gateway for ephemeral `mailbox:available` hints; durable HTTP mailbox fetch |
| Primary database | Supabase Postgres / different Express adapters | **Private PostgreSQL, cloud-managed or self-operated**, with Whispr-owned schema for accounts/identity mappings, devices, prekeys, pending ciphertext, dedup and transactional notifications |
| Client history | Server-stored ciphertext (`messages`), browser keyring in `localStorage` | Protected **local-first IndexedDB** records; OPFS encrypted media; optional native encrypted SQLite later |
| Encrypted media | Full pipeline not implemented | **Private cloud object storage (such as S3) or self-operated compatible storage**; scoped encrypted chunks; optional authorized CDN |
| Caching/presence | No proven production Redis coordination | **Optional Redis**, reconstructible public metadata and gateway/presence state; isolate rate-limit controls |
| E2EE | P-256 ECDH + HKDF-SHA256 + AES-GCM, long-lived key model | Reviewed authenticated asynchronous/ratcheting protocol and per-device sessions with safety numbers |
| Backup | Login-password-derived legacy encrypted private-key backup | Explicit independent recovery secret; versioned client-encrypted backup and tested restore |
| Validation | Existing Node/Vitest suites, mostly prototype | OIDC/JWKS tests, backend authorization, database transactions, encrypted local DB, protocol vectors, media and migration E2E |
| Ops/CI | No verified high-availability deployment | Docker Compose for test/dev; **cloud-hosted** containers with managed infrastructure options, backup/restore drills, least-privilege IAM and privacy-safe telemetry |

## Self-hosted authentication decision

Do **not** implement production password hashing, login recovery, MFA, Google OAuth or token issuance from scratch. Select and maintain a reviewed self-hosted OIDC provider. An OIDC identity is bound to a stable Whispr `accounts.account_id` through a verified `(issuer,subject)` mapping; never silently merge users by email and never assume account auth is device identity verification. Existing `/demo` weak JWT fallback is unacceptable for the production path.

## Database and storage ownership

Whispr-controlled PostgreSQL (preferably cloud-managed in production) holds **only operational metadata and pending ciphertext**, with narrow tables described in [Optimized Database Design](./14_Optimized_Database_Design.md). The client keeps history and ratchet state; Redis and Socket.IO are never authoritative for undelivered envelopes; object storage holds ciphertext file bytes, not keys/plaintext.

## Deployment principle

Start with **one modular backend in cloud containers**, private cloud-managed PostgreSQL, a separately operated OIDC provider and private object storage. Redis is optional. Use Docker Compose for isolated development and backed-up, TLS-protected **cloud infrastructure** for the initial production region. Do not deploy Kafka, Kubernetes, multi-region writers, partitioning or separate microservices without observed need.

## Scalability options (not installed)

| Component | Timing / boundaries |
| --- | --- |
| Redis | Add for multi-replica Socket.IO presence/gateway routing, safe public cache and isolated rate-limit state; fail conservatively when security controls are unavailable |
| WebSocket replicas | Stateless and independently scalable; every reconnect performs authoritative mailbox fetch |
| PostgreSQL indexes/expiry | Required at mailbox implementation; keyset pagination, dedup ledger, transactional notification outbox and bounded GC |
| PostgreSQL partitioning | Defer until measured queue growth/index/retention pressure |
| Private CDN | Optional for authenticated encrypted media with correct cache key/capability handling |
| Kafka / distributed broker | Defer unless Postgres transactional outbox + gateway hints cannot meet demonstrated throughput |
| Multi-region mailbox | Defer; eventual regional owners require fenced failover |
| Monitoring | p95 acceptance/ACK, queue age, Redis/gateway failures and media transfer; no plaintext/keys/contact graph logs |

## Cloud deployment reference (TARGET)

Whispr can deploy its **own controllers and reviewed OIDC provider on a cloud compute platform** while using provider-managed PostgreSQL, private object storage, Redis, networking and observability. AWS ECS/Fargate + RDS PostgreSQL + S3 + Secrets Manager is one reference profile. Provider-neutral OIDC, PostgreSQL, container and object-storage contracts reduce lock-in; no provider has been selected or deployed yet.

See [Cloud Hosting and Deployment](./16_Cloud_Hosting_and_Deployment.md) for topology, cost controls, IAM boundaries, WebSocket scaling and recovery gates. Cloud-managed infrastructure is compatible with **no Supabase target dependency**.

## Preferred deployment providers (TARGET / NOT RUNNING)

The first planned cloud deployment uses **Vercel for Next.js `client/`**, **Render for Whispr-controlled backend API + Socket.IO**, a maintained OIDC provider deployed on Render, and **paid Render PostgreSQL** for durable pending ciphertext and metadata. Keep Redis-compatible **Render Key Value optional**, adding it only for multi-gateway coordination or measured cache needs.

**Media is a separate feature:** ship text-only messaging without any object-storage requirement. When encrypted attachments are implemented, prefer a **private Cloudflare R2 bucket** and a replaceable S3-compatible storage adapter, using short-lived signed URL capabilities for ciphertext. No **AWS S3** account/service is required. Other object stores are interchangeable only after adapter/security tests. **Render local disks are not suitable as scalable shared attachment storage.**

Vercel and Render deployment settings must distinguish browser-public API/OIDC config from server-only DB/IdP/R2 credentials. Use always-on paid Render web services and backed-up paid PostgreSQL for actual users; a free-tier sleeping backend or expiring DB is for disposable tests only.

See [Vercel + Render + Optional R2](./17_Render_Vercel_R2_Deployment.md). AWS ECS/RDS/S3 in [Cloud Hosting](./16_Cloud_Hosting_and_Deployment.md) remains an **alternative**.

## Browser trust limitation

A web client served malicious JavaScript can lose plaintext confidentiality, even when servers are self-hosted. Web Crypto non-extractable keys alone cannot defeat same-origin malicious script. A signed desktop/mobile app is a potential future hardening path.

## References

[Self-Hosted Backend / Supabase Exit](./15_Self_Hosted_Backend_and_Supabase_Exit.md) · [System Architecture](./04_System_Architecture.md) · [Cryptography](./05_Cryptography_Security_Flow.md) · [Database](./08_Database_Design.md) · [Scalability](./13_Scalability_and_Caching.md).
