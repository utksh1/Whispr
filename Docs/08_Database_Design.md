# Whispr — Database Design

## Current Product Storage

The product app (`/app`) now uses Supabase Auth, Postgres, and Realtime.

Supabase project ref: `lptfbgohubujthjnerwm`

Current public tables:
- `profiles`: user discovery, active public key, backup presence flag
- `user_keys`: historical public keys by deterministic key id
- `private_key_backups`: encrypted keyring backup material only
- `messages`: ciphertext, nonce, salt, sender/receiver ids, key ids, timestamps

See `Docs/10_Supabase_Setup.md` and [supabase/whispr_schema.sql](/Users/Utkarsh/Desktop/Projects/Whispr/supabase/whispr_schema.sql) for the exact table definitions, indexes, RLS policies, and Realtime setup.

The SQL-style schema below remains the repository/server target model and maps directly to the Supabase tables.

## 1. Users Table
```sql
users (
  id UUID PRIMARY KEY,
  username VARCHAR UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  public_key TEXT,
  active_public_key_id TEXT,
  created_at TIMESTAMP NOT NULL
)
```

`public_key` and `active_public_key_id` represent the currently active account key for new inbound messages. Historical keys stay in `user_keys`.

## 2. User Keys Table
```sql
user_keys (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  public_key TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true
)
```

`id` is a deterministic SHA-256 hash of the public key. Old public keys remain retrievable by id so historical messages can point to the key version used.

## 3. Private Key Backups Table
```sql
private_key_backups (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  ciphertext TEXT NOT NULL,
  salt TEXT NOT NULL,
  iv TEXT NOT NULL,
  version TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL
)
```

This stores encrypted keyring backup material only. Plaintext private keys must never be stored.

## 4. Conversations Table
```sql
conversations (
  id UUID PRIMARY KEY,
  participant_key TEXT UNIQUE NOT NULL,
  user_a_id UUID REFERENCES users(id),
  user_b_id UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  last_message_at TIMESTAMP
)
```

## 5. Optional Chat Sessions Table
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

## 6. Messages Table
```sql
messages (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  session_id UUID REFERENCES chat_sessions(id),
  sender_id UUID REFERENCES users(id),
  sender_key_id TEXT REFERENCES user_keys(id),
  receiver_key_id TEXT REFERENCES user_keys(id),
  ciphertext TEXT NOT NULL,
  nonce TEXT NOT NULL,
  salt TEXT NOT NULL,
  version TEXT NOT NULL,
  tampered BOOLEAN DEFAULT false,
  tampered_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL
)
```

`sender_key_id` and `receiver_key_id` are required for old-chat readability after key rotation. The client uses those ids to select the right private key from its local or restored keyring.

If we want a lighter session version first, `session_id` can stay nullable and we can treat `id` of the first message as the session anchor in application logic before adding a dedicated `chat_sessions` table.

## 7. Optional Message Metadata Table
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

## Private Key Lifecycle Note
Whispr should keep these key concepts separate:
- JWT auth token: account/API access
- local private keyring: message access
- active public key: key used for future inbound messages
- historical public keys: key ids referenced by old messages
- encrypted backup: server-stored ciphertext that can restore the keyring on a new device

Logout clears the auth token but should not delete the local private keyring. Key regeneration should add a new keypair instead of deleting old private keys.

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
