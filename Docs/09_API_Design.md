# 🛣️ Whispr — API Design

This document outlines the RESTful API endpoints for the Whispr backend.

This is a target API design. The current backend implementation is earlier-stage and does not yet expose all endpoints described here.

## 🔐 Authentication

### `POST /auth/register`
Create a new user account.
- **Request Body:**
  ```json
  {
    "username": "alice",
    "password": "plaintext_password_sent_over_tls",
    "publicKey": "base64_encoded_x25519_pubkey"
  }
  ```

The backend should hash the password before storage. Clients should not pre-hash passwords unless the full protocol is intentionally designed around that behavior.

### `POST /auth/login`
Authenticate and return a session token.
- **Response:**
  ```json
  {
    "token": "jwt_token_here",
    "userId": "uuid-1234"
  }
  ```

---

## 🔑 Key Management

### `POST /keys/upload`
Update or rotate the user's public key.
- **Request Body:**
  ```json
  { "publicKey": "..." }
  ```

### `GET /keys/:userId`
Retrieve the public key for a target user to initiate an E2EE session.
- **Response:**
  ```json
  { "userId": "...", "publicKey": "..." }
  ```

---

## 💬 Conversations & Messages

### `POST /messages`
Send an encrypted message payload. The server acts as a blind relay.
- **Request Body:**
  ```json
  {
    "conversationId": "uuid-5678",
    "ciphertext": "base64_payload",
    "nonce": "base64_nonce",
    "receiverId": "uuid-9012"
  }
  ```

Depending on the final integrity design, the payload may also include a signature, key identifier, message version, or replay-protection field.

### `GET /messages/:conversationId`
Fetch encrypted messages for a specific conversation.
- **Response:**
  ```json
  [
    {
      "id": "msg-001",
      "senderId": "uuid-1234",
      "ciphertext": "...",
      "timestamp": "2024-04-17T12:00:00Z"
    }
  ]
  ```

---

## ⚡ Realtime Events (WebSockets)

| Event | Direction | Description |
| :--- | :--- | :--- |
| `message:send` | Client -> Server | Submit encrypted payload |
| `message:receive` | Server -> Client | Relay payload to target |
| `message:delivered` | Server -> Client | Confirm delivery to sender |

---

## 🛡️ Security Best Practices
- **Payload Validation:** Use Zod/Joi to enforce strict schemas.
- **Privacy First:** The server MUST NOT log ciphertext or any metadata that could be used for fingerprinting.
- **Rate Limiting:** Protect all endpoints against brute-force and DoS attacks.
- **Password Storage:** Store only salted password hashes, never plaintext or reversible encrypted passwords.
