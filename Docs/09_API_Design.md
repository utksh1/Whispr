# 🛣️ Whispr — API Design

This document outlines the RESTful API endpoints for the current Whispr MVP backend.

These endpoints reflect the implemented in-memory authenticated flow. A Postgres-backed adapter is planned behind the same contracts.

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
      "hasPublicKey": false
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
      "hasPublicKey": true
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
      "hasPublicKey": true
    }
  }
  ```

---

## 🔑 Key Management

### `PUT /me/public-key`
Update or rotate the user's public key.

- **Auth:** Bearer token required
- **Request Body:**
  ```json
  { "publicKey": "..." }
  ```

### `GET /users/:username/public-key`
Retrieve the public key for a target user.

- **Auth:** Bearer token required
- **Response:**
  ```json
  { "username": "bob", "publicKey": "..." }
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
        "hasPublicKey": true
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
    "nonce": "base64_nonce"
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
        "senderUsername": "alice",
        "receiverUsername": "bob",
        "ciphertext": "...",
        "nonce": "...",
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
