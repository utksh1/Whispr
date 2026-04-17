# Whispr — Database Design

## 1. Users Table
```sql
users (
  id UUID PRIMARY KEY,
  username VARCHAR UNIQUE NOT NULL,
  email VARCHAR UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL
)
```

## 2. Devices / Keys Table
```sql
device_keys (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  device_name VARCHAR,
  public_key TEXT NOT NULL,
  key_version INT DEFAULT 1,
  created_at TIMESTAMP NOT NULL
)
```

## 3. Conversations Table
```sql
conversations (
  id UUID PRIMARY KEY,
  user1_id UUID REFERENCES users(id),
  user2_id UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL
)
```

## 4. Optional Chat Sessions Table
```sql
chat_sessions (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  root_message_id UUID,
  started_by_user_id UUID REFERENCES users(id),
  status VARCHAR DEFAULT 'active',
  created_at TIMESTAMP NOT NULL,
  closed_at TIMESTAMP
)
```

Use this if Whispr needs a bounded "session inside a conversation" model.

Recommended rule:
- the first message in a session becomes the root anchor
- `root_message_id` can be the stable reference used to group later messages
- auth sessions should remain separate and must not reuse message ids

## 5. Messages Table
```sql
messages (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  session_id UUID REFERENCES chat_sessions(id),
  sender_id UUID REFERENCES users(id),
  receiver_id UUID REFERENCES users(id),
  ciphertext TEXT NOT NULL,
  nonce TEXT NOT NULL,
  signature TEXT,
  status VARCHAR DEFAULT 'sent',
  created_at TIMESTAMP NOT NULL
)
```

If we want a lighter version first, `session_id` can stay nullable and we can treat `id` of the first message as the session anchor in application logic before adding a dedicated `chat_sessions` table.

## 6. Optional Message Metadata Table
```sql
message_metadata (
  id UUID PRIMARY KEY,
  message_id UUID REFERENCES messages(id),
  delivered_at TIMESTAMP,
  read_at TIMESTAMP
)
```

## Design Principle
Only encrypted payloads and safe operational metadata should be stored. Plaintext messages must never be stored in the database.

## Session Design Note
Whispr should keep these identifiers separate:
- user auth session: login state and JWT lifecycle
- conversation id: stable two-user relationship
- chat session id: optional grouped exchange inside one conversation
- message id: immutable record identifier

Using the first message id as a session anchor is reasonable.
Using a message id as the actual auth session identifier is not recommended.

## Implementation Note

This schema is a target design, not a guarantee that every table already exists in the running codebase.
