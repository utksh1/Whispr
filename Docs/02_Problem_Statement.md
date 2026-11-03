# Whispr — Problem Statement

## Problem

Typical messaging products may encrypt transport yet retain conversation data or server-managed decryption capability. Even ciphertext-only server archives increase retention, recovery and metadata obligations. Secure messaging must handle offline recipients, lost devices, attachments, identity substitution and failures without pretending the backend is universally trusted.

## Target outcome

Build the **existing Whispr application** into a local-first, end-to-end encrypted messaging product where:

- Only authorized endpoints process message and attachment plaintext.
- Long-term history belongs in locally protected storage, not a perpetual server message table.
- The server retains a short-lived, access-controlled encrypted mailbox for offline delivery, deleting per-device envelopes after durable ACK or expiration.
- Attachments are encrypted on-device, stored as time-limited ciphertext objects and decrypted on recipients' devices.
- Peer identity is authenticated/verified beyond trusting any server-supplied public key.
- Backup recovery uses a separately controlled secret and does not silently overwrite older encrypted key material.
- Crash/retry/replay behavior has explicit delivery semantics and testable guarantees.

## Main engineering challenges

Crash-safe ratchet and local DB state; asynchronous key exchange; malicious-directory detection; per-device fanout; queue authorization and RLS; offline timeout semantics; secure media chunking; multi-device recovery; migration of existing encrypted server history; endpoint/browser security.

## Measurable success

Demonstrate two independent devices exchanging E2EE messages while one is offline; verified local persistence; server queue empty after recipient's durable ACK; attachment ciphertext unreadable by object store; repeated/reordered delivery safe; identity substitution detected/warned; failure to decrypt backup never overwrites it; browser/DB breach limitations documented.

## Additional scalability success criteria (TARGET)

At agreed peak load, the system must preserve per-device mailbox delivery despite Redis notification loss, gateway restarts, duplicate request retries and recipient reconnects. It must apply quotas/backpressure rather than falsely accept undurable messages, retain only bounded pending ciphertext, and prevent a cached device key or CDN object from bypassing access rules. Client-local messages must be recoverable from explicitly configured encrypted backups when storage is lost.

Candidate service targets and measurable traffic formulas are specified in [Scalability and Caching](./13_Scalability_and_Caching.md). No benchmark or operational SLO is claimed yet.

## Non-goals

Immediate group chat, calls, federation, high-scale distributed microservices, guaranteed recipient deletion, anonymity from global observers, or protection from an actively compromised endpoint.

**Current state:** Whispr currently has a functional encrypted-message prototype with permanent ciphertext storage and a separate demo backend; this target behavior is **not yet implemented**. See [Architecture](./04_System_Architecture.md) and [Roadmap](./10_Development_Roadmap.md).
