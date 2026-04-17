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

## 4. Messages Table
```sql
messages (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  sender_id UUID REFERENCES users(id),
  receiver_id UUID REFERENCES users(id),
  ciphertext TEXT NOT NULL,
  nonce TEXT NOT NULL,
  signature TEXT,
  status VARCHAR DEFAULT 'sent',
  created_at TIMESTAMP NOT NULL
)
```

## 5. Optional Message Metadata Table
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

## Implementation Note

This schema is a target design, not a guarantee that every table already exists in the running codebase.
