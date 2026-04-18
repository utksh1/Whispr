const crypto = require("node:crypto");
const { keyIdFor } = require("../utils/key-id");

class InMemoryUserRepository {
  constructor() {
    this.usersById = new Map();
    this.idsByUsername = new Map();
    this.keysById = new Map();
    this.keyIdsByUserId = new Map();
    this.privateKeyBackupsByUserId = new Map();
  }

  decorateUser(user) {
    return {
      ...user,
      hasPrivateKeyBackup: this.privateKeyBackupsByUserId.has(user.id),
    };
  }

  async createUser({ username, passwordHash }) {
    const normalizedUsername = username.trim().toLowerCase();
    const now = new Date().toISOString();
    const user = {
      id: crypto.randomUUID(),
      username: normalizedUsername,
      passwordHash,
      publicKey: null,
      activePublicKeyId: null,
      createdAt: now,
      updatedAt: now,
    };

    this.usersById.set(user.id, user);
    this.idsByUsername.set(user.username, user.id);
    this.keyIdsByUserId.set(user.id, []);

    return this.decorateUser(user);
  }

  async findById(userId) {
    const user = this.usersById.get(userId);
    return user ? this.decorateUser(user) : null;
  }

  async findByUsername(username) {
    const normalizedUsername = username.trim().toLowerCase();
    const userId = this.idsByUsername.get(normalizedUsername);

    if (!userId) {
      return null;
    }

    const user = this.usersById.get(userId);
    return user ? this.decorateUser(user) : null;
  }

  async searchUsers(query) {
    const normalizedQuery = (query || "").trim().toLowerCase();

    return Array.from(this.usersById.values())
      .filter((user) => !normalizedQuery || user.username.includes(normalizedQuery))
      .sort((left, right) => left.username.localeCompare(right.username))
      .map((user) => ({
        id: user.id,
        username: user.username,
        hasPublicKey: Boolean(user.publicKey),
        activePublicKeyId: user.activePublicKeyId || null,
        hasPrivateKeyBackup: this.privateKeyBackupsByUserId.has(user.id),
      }));
  }

  async setPublicKey(userId, publicKey) {
    const user = this.usersById.get(userId);

    if (!user) {
      return null;
    }

    const nextUpdatedAt = new Date().toISOString();
    const keyId = keyIdFor(publicKey);
    const existingKey = this.keysById.get(keyId);

    if (!existingKey) {
      this.keysById.set(keyId, {
        id: keyId,
        userId,
        publicKey,
        createdAt: nextUpdatedAt,
        revokedAt: null,
        isActive: true,
      });
      this.keyIdsByUserId.set(userId, [...(this.keyIdsByUserId.get(userId) || []), keyId]);
    }

    const previousKeyId = user.activePublicKeyId;

    if (previousKeyId && previousKeyId !== keyId) {
      const previousKey = this.keysById.get(previousKeyId);

      if (previousKey) {
        this.keysById.set(previousKeyId, {
          ...previousKey,
          isActive: false,
        });
      }
    }

    const nextUser = {
      ...user,
      publicKey,
      activePublicKeyId: keyId,
      updatedAt: nextUpdatedAt,
    };

    this.usersById.set(userId, nextUser);
    this.keysById.set(keyId, {
      ...(this.keysById.get(keyId) || {}),
      id: keyId,
      userId,
      publicKey,
      createdAt: existingKey?.createdAt || nextUpdatedAt,
      revokedAt: null,
      isActive: true,
    });

    return this.decorateUser(nextUser);
  }

  async findPublicKeyById(keyId) {
    const key = this.keysById.get(keyId);

    if (!key) {
      return null;
    }

    const user = this.usersById.get(key.userId);

    return user
      ? {
          ...key,
          username: user.username,
        }
      : null;
  }

  async setPrivateKeyBackup(userId, backup) {
    const user = this.usersById.get(userId);

    if (!user) {
      return null;
    }

    const nextBackup = {
      ...backup,
      userId,
      updatedAt: new Date().toISOString(),
    };

    this.privateKeyBackupsByUserId.set(userId, nextBackup);
    return nextBackup;
  }

  async getPrivateKeyBackup(userId) {
    const backup = this.privateKeyBackupsByUserId.get(userId);
    return backup ? { ...backup } : null;
  }

  toState() {
    return {
      usersById: Array.from(this.usersById.entries()),
      idsByUsername: Array.from(this.idsByUsername.entries()),
      keysById: Array.from(this.keysById.entries()),
      keyIdsByUserId: Array.from(this.keyIdsByUserId.entries()),
      privateKeyBackupsByUserId: Array.from(this.privateKeyBackupsByUserId.entries()),
    };
  }

  fromState(state) {
    this.usersById = new Map(state.usersById || []);
    this.idsByUsername = new Map(state.idsByUsername || []);
    this.keysById = new Map(state.keysById || []);
    this.keyIdsByUserId = new Map(state.keyIdsByUserId || []);
    this.privateKeyBackupsByUserId = new Map(state.privateKeyBackupsByUserId || []);
  }
}

module.exports = {
  InMemoryUserRepository,
  keyIdFor,
};
