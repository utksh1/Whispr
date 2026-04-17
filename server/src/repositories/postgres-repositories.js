const crypto = require("node:crypto");
const { Pool } = require("pg");

function conversationIdFor(userId, peerId) {
  return [userId, peerId].sort().join(":");
}

class PostgresUserRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async createUser({ username, passwordHash }) {
    const normalizedUsername = username.trim().toLowerCase();
    const user = {
      id: crypto.randomUUID(),
      username: normalizedUsername,
      passwordHash,
    };
    const result = await this.pool.query(
      `insert into users (id, username, password_hash)
       values ($1, $2, $3)
       returning id, username, password_hash as "passwordHash", public_key as "publicKey", created_at as "createdAt", updated_at as "updatedAt"`,
      [user.id, user.username, user.passwordHash]
    );

    return result.rows[0];
  }

  async findById(userId) {
    const result = await this.pool.query(
      `select id, username, password_hash as "passwordHash", public_key as "publicKey", created_at as "createdAt", updated_at as "updatedAt"
       from users where id = $1 limit 1`,
      [userId]
    );

    return result.rows[0] || null;
  }

  async findByUsername(username) {
    const result = await this.pool.query(
      `select id, username, password_hash as "passwordHash", public_key as "publicKey", created_at as "createdAt", updated_at as "updatedAt"
       from users where username = $1 limit 1`,
      [username.trim().toLowerCase()]
    );

    return result.rows[0] || null;
  }

  async searchUsers(query) {
    const normalizedQuery = `${(query || "").trim().toLowerCase()}%`;
    const result = await this.pool.query(
      `select id, username, public_key as "publicKey"
       from users
       where username like $1
       order by username asc
       limit 50`,
      [normalizedQuery]
    );

    return result.rows.map((user) => ({
      id: user.id,
      username: user.username,
      hasPublicKey: Boolean(user.publicKey),
    }));
  }

  async setPublicKey(userId, publicKey) {
    const result = await this.pool.query(
      `update users
       set public_key = $2, updated_at = now()
       where id = $1
       returning id, username, password_hash as "passwordHash", public_key as "publicKey", created_at as "createdAt", updated_at as "updatedAt"`,
      [userId, publicKey]
    );

    return result.rows[0] || null;
  }
}

class PostgresMessageRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async createMessage({
    senderId,
    receiverId,
    senderUsername,
    receiverUsername,
    ciphertext,
    nonce,
    salt,
    version,
  }) {
    const message = {
      id: crypto.randomUUID(),
      conversationId: conversationIdFor(senderId, receiverId),
      senderId,
      receiverId,
      senderUsername,
      receiverUsername,
      ciphertext,
      nonce,
      salt,
      version,
    };
    const result = await this.pool.query(
      `insert into messages (
         id, conversation_id, sender_id, receiver_id, sender_username, receiver_username, ciphertext, nonce, salt, version
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       returning id, conversation_id as "conversationId", sender_id as "senderId", receiver_id as "receiverId",
                 sender_username as "senderUsername", receiver_username as "receiverUsername",
                 ciphertext, nonce, salt, version, created_at as "createdAt", tampered, tampered_at as "tamperedAt"`,
      [
        message.id,
        message.conversationId,
        message.senderId,
        message.receiverId,
        message.senderUsername,
        message.receiverUsername,
        message.ciphertext,
        message.nonce,
        message.salt,
        message.version,
      ]
    );

    return result.rows[0];
  }

  async listConversation(userId, peerId) {
    const result = await this.pool.query(
      `select id, conversation_id as "conversationId", sender_id as "senderId", receiver_id as "receiverId",
              sender_username as "senderUsername", receiver_username as "receiverUsername",
              ciphertext, nonce, salt, version, created_at as "createdAt", tampered, tampered_at as "tamperedAt"
       from messages
       where conversation_id = $1
       order by created_at asc`,
      [conversationIdFor(userId, peerId)]
    );

    return result.rows;
  }

  async findById(messageId) {
    const result = await this.pool.query(
      `select id, conversation_id as "conversationId", sender_id as "senderId", receiver_id as "receiverId",
              sender_username as "senderUsername", receiver_username as "receiverUsername",
              ciphertext, nonce, salt, version, created_at as "createdAt", tampered, tampered_at as "tamperedAt"
       from messages
       where id = $1
       limit 1`,
      [messageId]
    );

    return result.rows[0] || null;
  }

  async markTampered(messageId, mutateBase64) {
    const existingMessage = await this.findById(messageId);

    if (!existingMessage) {
      return null;
    }

    const result = await this.pool.query(
      `update messages
       set ciphertext = $2, tampered = true, tampered_at = now()
       where id = $1
       returning id, conversation_id as "conversationId", sender_id as "senderId", receiver_id as "receiverId",
                 sender_username as "senderUsername", receiver_username as "receiverUsername",
                 ciphertext, nonce, salt, version, created_at as "createdAt", tampered, tampered_at as "tamperedAt"`,
      [messageId, mutateBase64(existingMessage.ciphertext)]
    );

    return result.rows[0] || null;
  }
}

async function ensureSchema(pool) {
  await pool.query(`
    create table if not exists users (
      id uuid primary key,
      username varchar(32) unique not null,
      password_hash text not null,
      public_key text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  await pool.query(`
    create table if not exists messages (
      id uuid primary key,
      conversation_id text not null,
      sender_id uuid not null references users(id) on delete cascade,
      receiver_id uuid not null references users(id) on delete cascade,
      sender_username varchar(32) not null,
      receiver_username varchar(32) not null,
      ciphertext text not null,
      nonce text not null,
      salt text not null,
      version text not null,
      tampered boolean not null default false,
      tampered_at timestamptz,
      created_at timestamptz not null default now()
    );
  `);

  await pool.query(`
    create index if not exists messages_conversation_created_at_idx
    on messages (conversation_id, created_at);
  `);
}

function createPostgresRepositories(config) {
  if (!config.databaseUrl) {
    throw new Error(
      "DATABASE_URL is required when STORAGE_DRIVER=postgres."
    );
  }

  const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  const schemaReady = ensureSchema(pool);

  return {
    async ready() {
      await schemaReady;
    },
    pool,
    users: new PostgresUserRepository(pool),
    messages: new PostgresMessageRepository(pool),
  };
}

module.exports = {
  createPostgresRepositories,
};
