# 🛣️ Whispr — API Design

## Current Product Appwrite Interfaces

The user-facing `/app` route now talks directly to Appwrite:
- Appwrite Auth handles email/password registration, login, current account lookup, and logout.
- Appwrite Databases stores user profiles, public keys, encrypted key backups, and ciphertext-only messages.
- The browser still performs encryption and decryption locally before any message payload is written.

Client-side Appwrite configuration:
```env
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://nyc.cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=69e2ba2700132ed5d552
NEXT_PUBLIC_APPWRITE_PROJECT_NAME=Whispr
NEXT_PUBLIC_APPWRITE_DATABASE_ID=whispr
```

Product data collections:
- `users`
- `user_keys`
- `private_key_backups`
- `messages`

See `Docs/10_Appwrite_Setup.md` for collection schema and permissions.

## Legacy / Demo Express API

This document outlines the RESTful API endpoints for the current Whispr MVP backend.

These endpoints reflect the implemented authenticated flow with repository-backed storage. Production uses Postgres; local development may use memory or filesystem adapters.

## 🔐 Authentication

### `POST /auth/register`
Create a new user account.
- **Request Body:**
  ```json
  {
    "username": "alice",
    "password": "plaintext_password_sent_over_tls"
  }
  ```

- **Response:**
  ```json
  {
    "token": "jwt_token_here",
    "user": {
      "id": "uuid-1234",
      "username": "alice",
      "hasPublicKey": false,
      "activePublicKeyId": null,
      "hasPrivateKeyBackup": false
    }
  }
  ```

### `POST /auth/login`
Authenticate and return a session token.
- **Response:**
  ```json
  {
    "token": "jwt_token_here",
    "user": {
      "id": "uuid-1234",
      "username": "alice",
      "hasPublicKey": true,
      "activePublicKeyId": "sha256-public-key-id",
      "hasPrivateKeyBackup": true
    }
  }
  ```

### `GET /auth/me`
Return the currently authenticated user.

- **Auth:** Bearer token required
- **Response:**
  ```json
  {
    "user": {
      "id": "uuid-1234",
      "username": "alice",
      "hasPublicKey": true,
      "activePublicKeyId": "sha256-public-key-id",
      "hasPrivateKeyBackup": true
    }
  }
  ```

---

## 🔑 Key Management

### `PUT /me/public-key`
Set or rotate the user's active public key. The previous public key remains addressable by key id so old messages can still identify which key version was used.

- **Auth:** Bearer token required
- **Request Body:**
  ```json
  { "publicKey": "..." }
  ```
- **Response:**
  ```json
  {
    "user": {
      "id": "uuid-1234",
      "username": "alice",
      "hasPublicKey": true,
      "activePublicKeyId": "sha256-public-key-id",
      "hasPrivateKeyBackup": true
    }
  }
  ```

### `PUT /me/private-key-backup`
Store an encrypted backup of the client's serialized keyring.

- **Auth:** Bearer token required
- **Request Body:**
  ```json
  {
    "ciphertext": "base64-encrypted-keyring",
    "salt": "base64-salt",
    "iv": "base64-iv",
    "version": "backup-pbkdf2-aes-gcm-v1"
  }
  ```
- **Response:**
  ```json
  {
    "backup": {
      "version": "backup-pbkdf2-aes-gcm-v1",
      "updatedAt": "2026-04-18T10:00:00Z"
    }
  }
  ```

The server never receives plaintext private keys. It stores only encrypted backup material.

### `GET /me/private-key-backup`
Retrieve the authenticated user's encrypted keyring backup.

- **Auth:** Bearer token required
- **Response:**
  ```json
  {
    "backup": {
      "userId": "uuid-1234",
      "ciphertext": "base64-encrypted-keyring",
      "salt": "base64-salt",
      "iv": "base64-iv",
      "version": "backup-pbkdf2-aes-gcm-v1",
      "updatedAt": "2026-04-18T10:00:00Z"
    }
  }
  ```

### `GET /users/:username/public-key`
Retrieve the active public key for a target user.

- **Auth:** Bearer token required
- **Response:**
  ```json
  { "username": "bob", "publicKey": "...", "keyId": "sha256-public-key-id" }
  ```

### `GET /keys/:keyId`
Retrieve a historical or active public key by deterministic key id.

- **Auth:** Bearer token required
- **Response:**
  ```json
  {
    "key": {
      "id": "sha256-public-key-id",
      "username": "bob",
      "publicKey": "...",
      "isActive": false,
      "revokedAt": null
    }
  }
  ```

### `GET /users?query=<prefix>`
List users for chat discovery.

- **Auth:** Bearer token required
- **Response:**
  ```json
  {
    "users": [
      {
        "id": "uuid-5678",
        "username": "bob",
        "hasPublicKey": true,
        "activePublicKeyId": "sha256-public-key-id",
        "hasPrivateKeyBackup": true
      }
    ]
  }
  ```

---

## 💬 Conversations & Messages

### `POST /conversations/:peerUsername/messages`
Send an encrypted message payload. The server acts as a blind relay.

- **Auth:** Bearer token required
- **Request Body:**
  ```json
  {
    "ciphertext": "base64_payload",
    "nonce": "base64_nonce",
    "salt": "base64_salt",
    "version": "p256-hkdf-aes-gcm-v2"
  }
  ```

The server derives the sender from the authenticated session. Clients do not send `senderId`.

### `GET /conversations/:peerUsername/messages`
Fetch encrypted messages for the authenticated user's conversation with a peer.

- **Auth:** Bearer token required
- **Response:**
  ```json
  {
    "conversationId": "conversation-key",
    "messages": [
      {
        "id": "msg-001",
        "conversationId": "conversation-uuid",
        "senderKeyId": "alice-key-id",
        "receiverKeyId": "bob-key-id",
        "senderUsername": "alice",
        "receiverUsername": "bob",
        "ciphertext": "...",
        "nonce": "...",
        "salt": "...",
        "version": "p256-hkdf-aes-gcm-v2",
        "createdAt": "2024-04-17T12:00:00Z",
        "tampered": false
      }
    ]
  }
  ```

### `POST /messages/:messageId/tamper`
Intentionally corrupt a stored ciphertext for the demo harness.

- **Auth:** Bearer token required
- **Availability:** only when `ENABLE_DEMO_TOOLS=true`

### Proposed Session Direction
Every stored message already has a unique `id`. That gives us a natural anchor if we want to introduce a chat session layer later.

Recommended distinction:
- JWT auth session: identifies the logged-in client and should remain separate from message storage
- conversation id: identifies the long-lived relationship between two users
- chat session id: identifies one bounded exchange inside a conversation

Recommended approach:
- do not use a message id as the user's auth session token
- if we want sessionized chats, use the first message in a bounded exchange as the `rootMessageId`
- expose a derived `sessionId` or `rootMessageId` in message payloads for grouping

Example future response shape:
```json
{
  "conversationId": "user-a:user-b",
  "sessionId": "msg-root-001",
  "messages": [
    {
      "id": "msg-root-001",
      "sessionId": "msg-root-001",
      "senderUsername": "alice",
      "receiverUsername": "bob",
      "ciphertext": "...",
      "nonce": "...",
      "createdAt": "2026-04-18T10:00:00Z"
    },
    {
      "id": "msg-reply-002",
      "sessionId": "msg-root-001",
      "senderUsername": "bob",
      "receiverUsername": "alice",
      "ciphertext": "...",
      "nonce": "...",
      "createdAt": "2026-04-18T10:01:00Z"
    }
  ]
}
```

Why this is safer:
- message ids are immutable record ids, which makes them good anchors
- auth sessions rotate and expire, so tying them to message ids would mix unrelated concerns
- this keeps room for future features like per-session key rotation, replay protection, session closing, and judge-friendly demo grouping

---

## 🔁 Private Key Lifecycle

Whispr separates account access from message access:
- JWT login grants API/account access.
- Private keys grant ability to decrypt messages.
- Logout clears the JWT session but does not delete local private keys.
- Generating a new key adds it to the local keyring; older private keys are kept for old messages.
- Uploading a public key makes that key active for future incoming messages.

Encrypted backup model:
- The client serializes its keyring locally.
- The client encrypts the serialized keyring with PBKDF2 + AES-GCM using the user's secret.
- The server stores only `{ ciphertext, salt, iv, version }`.
- On a fresh device, login can fetch the encrypted backup and the client can decrypt it with the same user secret.

Old-chat readability:
- Messages store `senderKeyId` and `receiverKeyId`.
- The client picks the matching private key from the local/restored keyring.
- If that private key is missing, the UI should show a missing-key state rather than treating it as ciphertext tampering.

Current multi-device boundary:
- Only one active account public key is used for new inbound messages.
- Full per-device recipient fanout is deferred and will require device identities plus per-message recipient envelopes.

---

## ⚡ Realtime Events (WebSockets)

| Event | Direction | Description |
| :--- | :--- | :--- |
| socket handshake auth | Client -> Server | Provide bearer-style auth token through Socket.IO auth |
| `message:receive` | Server -> Client | Relay payload to authenticated participants |
| `message:tampered` | Server -> Client | Notify participants that demo tampering occurred |

---

## 🛡️ Security Best Practices
- **Payload Validation:** Use Zod/Joi to enforce strict schemas.
- **Privacy First:** The server MUST NOT log ciphertext or any metadata that could be used for fingerprinting.
- **Rate Limiting:** Protect all endpoints against brute-force and DoS attacks.
- **Password Storage:** Store only password hashes, never plaintext or reversible encrypted passwords.
