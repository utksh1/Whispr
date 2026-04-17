# 🔐 Whispr — Cryptography & Security Flow

Whispr is built on the principle that the backend is a **hostile environment**. Message confidentiality and integrity are guaranteed mathematically between clients, rather than via server-side policy.

---

## 🏗️ The E2EE Flow

The following diagram illustrates how a message moves from Sender A to Receiver B without the server being able to read it.

```mermaid
sequenceDiagram
    participant A as Alice (Sender)
    participant S as Whispr Server
    participant B as Bob (Receiver)

    Note over A, B: Key Exchange
    A->>S: Request Bob's Public Key (X25519)
    S-->>A: Bob's Public Key
    
    Note over A: Local Encryption
    A->>A: Generate Ephemeral Key & Nonce
    A->>A: Encrypt Plaintext + Auth Tag (ChaCha20-Poly1305)
    
    Note over A, S: Secure Relay
    A->>S: Send {conversationId, ciphertext, nonce}
    S->>S: Store encrypted payload (Blind Relay)
    
    Note over S, B: Real-time Delivery
    S->>B: Emit 'message:receive' {payload}
    
    Note over B: Local Decryption
    B->>B: Verify Auth Tag & Nonce
    B->>B: Decrypt using Private Key
    B->>B: Final Plaintext Displayed
```

---

## 🛠️ Cryptographic Primitives

We choose modern, performance-oriented primitives that are appropriate for web clients and can be implemented through the **Web Crypto API** and carefully selected supporting libraries where necessary.

### 1. Key Exchange (X25519)
Used to establish a shared secret or distribute public keys for asynchronous messaging. It provides high security with small key sizes.

### 2. Authenticated Encryption (AEAD)
Whispr should use a modern AEAD construction for message confidentiality and integrity. The exact implementation choice must match the actual client platform capabilities and should be documented when finalized.

### 3. Key Derivation (HKDF-SHA256)
All symmetric keys used for actual encryption are derived using HKDF to ensure high entropy and isolation between different security contexts.

### 4. Integrity and Authenticity
Digital signatures or equivalent authenticated message designs may be used to ensure that messages originated from the claimed sender and have not been modified or replayed.

---

## 🛡️ Trust Assumptions
- **The Server is Trusted for:** Availability, routing, and metadata management.
- **The Server is NOT Trusted for:** Privacy, content integrity, or identity verification (unless using PGP-style out-of-band verification).

---

> [!IMPORTANT]
> This document describes the intended security direction. The exact message format, key rotation policy, replay protection strategy, and signature model should be documented alongside implementation once they are finalized.
