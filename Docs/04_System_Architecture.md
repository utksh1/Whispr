# Whispr — System Architecture

## High-Level Components

### 1. Client Application
Responsible for:
- user login
- keypair generation
- encryption and decryption
- displaying messages
- verifying message authenticity

### 2. Backend Server
Responsible for:
- authentication
- storing user public keys
- routing encrypted messages
- storing ciphertext
- syncing offline messages

### 3. Database
Stores:
- user profiles
- public keys
- encrypted messages
- delivery status
- device metadata

## System Diagram

```mermaid
flowchart LR
  subgraph Clients["Trusted Client Devices"]
    subgraph Sender["Sender Client"]
      S1["Login / Session"]
      S2["Fetch Receiver Public Key"]
      S3["Encrypt Message Locally"]
    end

    subgraph Receiver["Receiver Client"]
      R1["Fetch Ciphertext"]
      R2["Decrypt Message Locally"]
      R3["Verify Authenticity"]
    end
  end

  subgraph Services["Untrusted Service Boundary"]
    subgraph Backend["Backend / Supabase Service"]
      B1["Authentication"]
      B2["Public Key Lookup"]
      B3["Message Relay + Offline Sync"]
    end

    subgraph Database["Database Storage"]
      D1["User Profiles"]
      D2["Public Keys"]
      D3["Encrypted Messages"]
      D4["Delivery Metadata"]
    end
  end

  S1 --> B1
  S2 --> B2
  B2 --> D2
  S3 --> B3
  B1 --> D1
  B3 --> D3
  B3 --> D4
  D3 --> R1
  D2 --> R1
  R1 --> R2 --> R3
```

## Trust Model
The backend is **untrusted for message confidentiality**.

This means:
- server can process requests
- server can relay encrypted data
- server cannot decrypt user messages

## Data Flow
1. Sender logs in
2. Sender fetches receiver public key
3. Sender encrypts message locally
4. Ciphertext is sent to backend
5. Backend stores and relays ciphertext
6. Receiver fetches ciphertext
7. Receiver decrypts message locally

## Architecture Style
- Frontend: Next.js / React / TypeScript
- Auth + Data Platform: Supabase Auth + Postgres
- Realtime Layer: Supabase Realtime
- Database direction: PostgreSQL
- Crypto Layer: Web Crypto API with modern elliptic-curve and AEAD primitives

## Implementation Note

This document describes the target system architecture. The current repository is still moving toward this design and does not yet implement every component listed here.
