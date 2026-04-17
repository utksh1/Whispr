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
- Frontend: React / Next.js
- Backend: Node.js / Express
- Realtime Layer: WebSocket / Socket.IO
- Database: PostgreSQL or MongoDB
- Crypto Layer: Web Crypto API + libsodium/tweetnacl
