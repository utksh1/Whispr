# Whispr — Cryptography & Security Flow

## Security Principle
Encryption must happen on the client before the message reaches the backend.

## Suggested Crypto Flow

### Identity Keys
Each user gets:
- one public key
- one private key

The public key can be shared.
The private key must remain protected on the client.

### Message Sending Flow
1. Sender composes a plaintext message
2. Sender fetches receiver public key
3. Sender derives or generates an encryption key
4. Sender encrypts the plaintext locally
5. Sender attaches authentication data / nonce / signature as needed
6. Sender sends ciphertext package to backend

### Message Receiving Flow
1. Receiver fetches encrypted message package
2. Receiver verifies integrity / authenticity
3. Receiver decrypts locally using private key or derived key
4. Plaintext is shown only on the receiver device

## Suggested Algorithms
- Public key crypto: X25519 / Curve25519
- Symmetric encryption: AES-GCM or ChaCha20-Poly1305
- Signatures: Ed25519
- Hashing / KDF: SHA-256 / HKDF

## Security Benefits
- Confidentiality against backend compromise
- Integrity against message tampering
- Controlled key ownership
- Practical, modern cryptographic building blocks

## Important Note
Do not claim “military-grade security” or “Signal-level security” unless formally justified. Keep claims accurate and practical.
