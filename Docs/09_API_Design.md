# Whispr — API Design

## Authentication
### POST /auth/register
Create a new user account

### POST /auth/login
Authenticate a user and return session token

## Keys
### POST /keys/upload
Upload user public key

### GET /keys/:userId
Fetch public key for a target user

## Conversations
### POST /conversations
Create or fetch a one-to-one conversation

### GET /conversations/:id
Fetch conversation metadata

## Messages
### POST /messages
Send encrypted message payload

### GET /messages/:conversationId
Fetch encrypted messages for a conversation

### PATCH /messages/:id/status
Update delivery or read status

## Realtime Events
- `message:send`
- `message:receive`
- `message:delivered`
- `message:read`

## Security Notes
- Validate every payload
- Never log plaintext
- Avoid logging raw ciphertext unnecessarily
- Use auth middleware on all protected routes
- Enforce rate limits
