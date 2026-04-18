const crypto = require("node:crypto");
const { Pool } = require("pg");
const { keyIdFor } = require("../utils/key-id");

function conversationIdFor(userId, peerId) {
  return [userId, peerId].sort().join(":");
}

function sortParticipantIds(userId, peerId) {
  return [userId, peerId].sort();
}

function conversationSelect(whereClause) {
  return `select id, participant_key as "participantKey", user_a_id as "userAId", user_b_id as "userBId",
                 created_at as "createdAt", updated_at as "updatedAt", last_message_at as "lastMessageAt"
          from conversations
          ${whereClause}`;
}

function messageSelect(whereClause) {
  return `select messages.id,
                 messages.conversation_id as "conversationId",
                 messages.sender_id as "senderId",
                 messages.sender_key_id as "senderKeyId",
                 messages.receiver_key_id as "receiverKeyId",
                 case
                   when messages.sender_id = conversations.user_a_id then conversations.user_b_id
                   else conversations.user_a_id
                 end as "receiverId",
                 sender.username as "senderUsername",
                 receiver.username as "receiverUsername",
                 messages.ciphertext,
                 messages.nonce,
                 messages.salt,
                 messages.version,
                 messages.created_at as "createdAt",
                 messages.tampered,
                 messages.tampered_at as "tamperedAt"
          from messages
          join conversations on conversations.id = messages.conversation_id
          join users as sender on sender.id = messages.sender_id
          join users as receiver on receiver.id = case
            when messages.sender_id = conversations.user_a_id then conversations.user_b_id
            else conversations.user_a_id
          end
          ${whereClause}`;
}

async function getColumnNames(pool, tableName) {
  const result = await pool.query(
    `select column_name
     from information_schema.columns
     where table_schema = 'public' and table_name = $1`,
    [tableName]
  );

  return result.rows.map((row) => row.column_name);
}

async function createMessagesTable(pool) {
  await pool.query(`
    create table if not exists messages (
      id uuid primary key,
      conversation_id uuid not null references conversations(id) on delete cascade,
      sender_id uuid not null references users(id) on delete cascade,
      sender_key_id text,
      receiver_key_id text,
      ciphertext text not null,
      nonce text not null,
      salt text not null,
      version text not null,
      tampered boolean not null default false,
      tampered_at timestamptz,
      created_at timestamptz not null default now()
    );
  `);
}

async function ensureUserKeyTables(pool) {
  await pool.query(`
    alter table users
    add column if not exists active_public_key_id text;
  `);

  await pool.query(`
    create table if not exists user_keys (
      id text primary key,
      user_id uuid not null references users(id) on delete cascade,
      public_key text not null,
      created_at timestamptz not null default now(),
      revoked_at timestamptz,
      is_active boolean not null default true
    );
  `);

  await pool.query(`
    create table if not exists private_key_backups (
      user_id uuid primary key references users(id) on delete cascade,
      ciphertext text not null,
      salt text not null,
      iv text not null,
      version text not null,
      updated_at timestamptz not null default now()
    );
  `);
}

async function createConversationIndexes(pool) {
  await pool.query(`
    create unique index if not exists conversations_participant_key_idx
    on conversations (participant_key);
  `);
}

async function createIndexes(pool) {
  await pool.query(`
    create index if not exists messages_conversation_created_at_idx
    on messages (conversation_id, created_at);
  `);
}

async function migrateLegacyMessages(pool) {
  const legacyColumns = await getColumnNames(pool, "messages_legacy");

  if (legacyColumns.length === 0) {
    return;
  }

  const distinctConversations = await pool.query(
    `select least(sender_id::text, receiver_id::text) as "userAId",
            greatest(sender_id::text, receiver_id::text) as "userBId",
            max(created_at) as "lastMessageAt"
     from messages_legacy
     group by 1, 2`
  );

  for (const conversation of distinctConversations.rows) {
    const participantKey = conversationIdFor(conversation.userAId, conversation.userBId);

    await pool.query(
      `insert into conversations (
         id, participant_key, user_a_id, user_b_id, last_message_at
       ) values ($1, $2, $3, $4, $5)
       on conflict (participant_key)
       do update set
         last_message_at = excluded.last_message_at,
         updated_at = now()`,
      [
        crypto.randomUUID(),
        participantKey,
        conversation.userAId,
        conversation.userBId,
        conversation.lastMessageAt,
      ]
    );
  }

  await pool.query(
    `insert into messages (
       id, conversation_id, sender_id, sender_key_id, receiver_key_id,
       ciphertext, nonce, salt, version, tampered, tampered_at, created_at
     )
     select legacy.id,
            conversations.id,
            legacy.sender_id,
            sender.active_public_key_id,
            receiver.active_public_key_id,
            legacy.ciphertext,
            legacy.nonce,
            legacy.salt,
            legacy.version,
            legacy.tampered,
            legacy.tampered_at,
            legacy.created_at
     from messages_legacy as legacy
     join conversations on conversations.participant_key = case
       when legacy.sender_id::text < legacy.receiver_id::text
         then legacy.sender_id::text || ':' || legacy.receiver_id::text
       else legacy.receiver_id::text || ':' || legacy.sender_id::text
     end
     join users as sender on sender.id = legacy.sender_id
     join users as receiver on receiver.id = legacy.receiver_id
     on conflict (id) do nothing`
  );

  await pool.query(`drop table messages_legacy`);
}

async function migrateLegacyUserKeys(pool) {
  const result = await pool.query(
    `select id, username, public_key as "publicKey", active_public_key_id as "activePublicKeyId"
     from users
     where public_key is not null`
  );

  for (const user of result.rows) {
    const keyId = user.activePublicKeyId || keyIdFor(user.publicKey);

    await pool.query(
      `insert into user_keys (id, user_id, public_key, is_active)
       values ($1, $2, $3, true)
       on conflict (id)
       do update set
         public_key = excluded.public_key,
         is_active = true`,
      [keyId, user.id, user.publicKey]
    );

    await pool.query(
      `update user_keys
       set is_active = false
       where user_id = $1 and id <> $2`,
      [user.id, keyId]
    );

    await pool.query(
      `update users
       set active_public_key_id = $2
       where id = $1`,
      [user.id, keyId]
    );
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
    create table if not exists conversations (
      id uuid primary key,
      participant_key text not null,
      user_a_id uuid not null references users(id) on delete cascade,
      user_b_id uuid not null references users(id) on delete cascade,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      last_message_at timestamptz
    );
  `);

  await ensureUserKeyTables(pool);
  await migrateLegacyUserKeys(pool);
  await createConversationIndexes(pool);

  const messageColumns = await getColumnNames(pool, "messages");
  const legacyColumns = await getColumnNames(pool, "messages_legacy");
  const hasLegacyMessagesTable = legacyColumns.length > 0;
  const hasLegacyMessagesShape = messageColumns.includes("sender_username");

  if (hasLegacyMessagesShape) {
    await pool.query("begin");

    try {
      await pool.query(`alter table messages rename to messages_legacy`);
      await createMessagesTable(pool);
      await migrateLegacyMessages(pool);
      await pool.query("commit");
    } catch (error) {
      await pool.query("rollback");
      throw error;
    }
  } else {
    await createMessagesTable(pool);

    await pool.query(`alter table messages add column if not exists sender_key_id text`);
    await pool.query(`alter table messages add column if not exists receiver_key_id text`);

    if (hasLegacyMessagesTable) {
      await pool.query("begin");

      try {
        await migrateLegacyMessages(pool);
        await pool.query("commit");
      } catch (error) {
        await pool.query("rollback");
        throw error;
      }
    }
  }

  await createIndexes(pool);
}

class PostgresUserRepository {
  constructor(pool) {
    this.pool = pool;
  }

  baseUserSelect(whereClause) {
    return `select users.id,
                   users.username,
                   users.password_hash as "passwordHash",
                   users.public_key as "publicKey",
                   users.active_public_key_id as "activePublicKeyId",
                   exists(
                     select 1
                     from private_key_backups
                     where private_key_backups.user_id = users.id
                   ) as "hasPrivateKeyBackup",
                   users.created_at as "createdAt",
                   users.updated_at as "updatedAt"
            from users
            ${whereClause}`;
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
       returning id, username, password_hash as "passwordHash", public_key as "publicKey",
                 active_public_key_id as "activePublicKeyId", false as "hasPrivateKeyBackup",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [user.id, user.username, user.passwordHash]
    );

    return result.rows[0];
  }

  async findById(userId) {
    const result = await this.pool.query(`${this.baseUserSelect("where users.id = $1 limit 1")}`, [userId]);

    return result.rows[0] || null;
  }

  async findByUsername(username) {
    const result = await this.pool.query(
      `${this.baseUserSelect("where users.username = $1 limit 1")}`,
      [username.trim().toLowerCase()]
    );

    return result.rows[0] || null;
  }

  async searchUsers(query) {
    const normalizedQuery = `%${(query || "").trim().toLowerCase()}%`;
    const result = await this.pool.query(
      `select users.id,
              users.username,
              users.public_key as "publicKey",
              users.active_public_key_id as "activePublicKeyId",
              exists(
                select 1
                from private_key_backups
                where private_key_backups.user_id = users.id
              ) as "hasPrivateKeyBackup"
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
      activePublicKeyId: user.activePublicKeyId || null,
      hasPrivateKeyBackup: Boolean(user.hasPrivateKeyBackup),
    }));
  }

  async setPublicKey(userId, publicKey) {
    const keyId = keyIdFor(publicKey);

    await this.pool.query(
      `insert into user_keys (id, user_id, public_key, is_active)
       values ($1, $2, $3, true)
       on conflict (id)
       do update set
         public_key = excluded.public_key,
         is_active = true,
         revoked_at = null`,
      [keyId, userId, publicKey]
    );

    await this.pool.query(
      `update user_keys
       set is_active = false
       where user_id = $1 and id <> $2`,
      [userId, keyId]
    );

    const result = await this.pool.query(
      `update users
       set public_key = $2, active_public_key_id = $3, updated_at = now()
       where id = $1
       returning id, username, password_hash as "passwordHash", public_key as "publicKey",
                 active_public_key_id as "activePublicKeyId", created_at as "createdAt", updated_at as "updatedAt"`,
      [userId, publicKey, keyId]
    );

    if (!result.rows[0]) {
      return null;
    }

    console.info("[keys] activated public key", { userId, keyId });

    return {
      ...result.rows[0],
      hasPrivateKeyBackup: Boolean((await this.getPrivateKeyBackup(userId))?.ciphertext),
    };
  }

  async findPublicKeyById(keyId) {
    const result = await this.pool.query(
      `select user_keys.id,
              user_keys.user_id as "userId",
              users.username,
              user_keys.public_key as "publicKey",
              user_keys.created_at as "createdAt",
              user_keys.revoked_at as "revokedAt",
              user_keys.is_active as "isActive"
       from user_keys
       join users on users.id = user_keys.user_id
       where user_keys.id = $1
       limit 1`,
      [keyId]
    );

    return result.rows[0] || null;
  }

  async setPrivateKeyBackup(userId, backup) {
    const result = await this.pool.query(
      `insert into private_key_backups (user_id, ciphertext, salt, iv, version, updated_at)
       values ($1, $2, $3, $4, $5, now())
       on conflict (user_id)
       do update set
         ciphertext = excluded.ciphertext,
         salt = excluded.salt,
         iv = excluded.iv,
         version = excluded.version,
         updated_at = now()
       returning user_id as "userId", ciphertext, salt, iv, version, updated_at as "updatedAt"`,
      [userId, backup.ciphertext, backup.salt, backup.iv, backup.version]
    );

    console.info("[keys] stored encrypted private key backup", { userId, version: backup.version });
    return result.rows[0] || null;
  }

  async getPrivateKeyBackup(userId) {
    const result = await this.pool.query(
      `select user_id as "userId", ciphertext, salt, iv, version, updated_at as "updatedAt"
       from private_key_backups
       where user_id = $1
       limit 1`,
      [userId]
    );

    return result.rows[0] || null;
  }
}

class PostgresMessageRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findConversationByParticipants(userId, peerId) {
    const result = await this.pool.query(
      `${conversationSelect("where participant_key = $1 limit 1")}`,
      [conversationIdFor(userId, peerId)]
    );

    return result.rows[0] || null;
  }

  async createConversationIfMissing(userId, peerId) {
    const [userAId, userBId] = sortParticipantIds(userId, peerId);
    const participantKey = conversationIdFor(userAId, userBId);

    const result = await this.pool.query(
      `insert into conversations (id, participant_key, user_a_id, user_b_id)
       values ($1, $2, $3, $4)
       on conflict (participant_key)
       do update set updated_at = now()
       returning id, participant_key as "participantKey", user_a_id as "userAId", user_b_id as "userBId",
                 created_at as "createdAt", updated_at as "updatedAt", last_message_at as "lastMessageAt"`,
      [crypto.randomUUID(), participantKey, userAId, userBId]
    );

    return result.rows[0];
  }

  async createMessage({
    senderId,
    receiverId,
    senderKeyId,
    receiverKeyId,
    ciphertext,
    nonce,
    salt,
    version,
  }) {
    const conversation = await this.createConversationIfMissing(senderId, receiverId);
    const messageId = crypto.randomUUID();
    const result = await this.pool.query(
      `insert into messages (
         id, conversation_id, sender_id, sender_key_id, receiver_key_id, ciphertext, nonce, salt, version
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       returning created_at as "createdAt"`,
      [
        messageId,
        conversation.id,
        senderId,
        senderKeyId,
        receiverKeyId,
        ciphertext,
        nonce,
        salt,
        version,
      ]
    );

    await this.pool.query(
      `update conversations
       set last_message_at = $2, updated_at = now()
       where id = $1`,
      [conversation.id, result.rows[0].createdAt]
    );

    console.info("[messages] stored encrypted message", {
      messageId,
      conversationId: conversation.id,
      senderKeyId,
      receiverKeyId,
    });

    return this.findById(messageId);
  }

  async listConversation(userId, peerId) {
    const result = await this.pool.query(
      `${messageSelect("where conversations.participant_key = $1 order by messages.created_at asc")}`,
      [conversationIdFor(userId, peerId)]
    );

    return result.rows;
  }

  async findById(messageId) {
    const result = await this.pool.query(
      `${messageSelect("where messages.id = $1 limit 1")}`,
      [messageId]
    );

    return result.rows[0] || null;
  }

  async markTampered(messageId, mutateBase64) {
    const existingMessage = await this.findById(messageId);

    if (!existingMessage) {
      return null;
    }

    await this.pool.query(
      `update messages
       set ciphertext = $2, tampered = true, tampered_at = now()
       where id = $1`,
      [messageId, mutateBase64(existingMessage.ciphertext)]
    );

    return this.findById(messageId);
  }

  async listConversations(userId) {
    const result = await this.pool.query(
      `select conversations.id,
              conversations.last_message_at as "lastMessageAt",
              conversations.updated_at as "updatedAt",
              case
                when user_a_id = $1 then user_b_id
                else user_a_id
              end as "peerId",
              users.username as "peerUsername",
              (
                select json_build_object(
                  'ciphertext', m.ciphertext,
                  'nonce', m.nonce,
                  'salt', m.salt,
                  'version', m.version
                )
                from messages m
                where m.conversation_id = conversations.id
                order by m.created_at desc
                limit 1
              ) as "lastMessage"
       from conversations
       join users on users.id = case
                                  when user_a_id = $1 then user_b_id
                                  else user_a_id
                                end
       where user_a_id = $1 or user_b_id = $1
       order by greatest(coalesce(last_message_at, conversations.created_at), conversations.updated_at) desc`,
      [userId]
    );

    return result.rows;
  }
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
