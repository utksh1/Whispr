const crypto = require("node:crypto");

class InMemoryUserRepository {
  constructor() {
    this.usersById = new Map();
    this.idsByUsername = new Map();
  }

  async createUser({ username, passwordHash }) {
    const normalizedUsername = username.trim().toLowerCase();
    const now = new Date().toISOString();
    const user = {
      id: crypto.randomUUID(),
      username: normalizedUsername,
      passwordHash,
      publicKey: null,
      createdAt: now,
      updatedAt: now,
    };

    this.usersById.set(user.id, user);
    this.idsByUsername.set(user.username, user.id);

    return { ...user };
  }

  async findById(userId) {
    const user = this.usersById.get(userId);
    return user ? { ...user } : null;
  }

  async findByUsername(username) {
    const normalizedUsername = username.trim().toLowerCase();
    const userId = this.idsByUsername.get(normalizedUsername);

    if (!userId) {
      return null;
    }

    const user = this.usersById.get(userId);
    return user ? { ...user } : null;
  }

  async searchUsers(query) {
    const normalizedQuery = (query || "").trim().toLowerCase();

    return Array.from(this.usersById.values())
      .filter((user) => !normalizedQuery || user.username.startsWith(normalizedQuery))
      .sort((left, right) => left.username.localeCompare(right.username))
      .map((user) => ({
        id: user.id,
        username: user.username,
        hasPublicKey: Boolean(user.publicKey),
      }));
  }

  async setPublicKey(userId, publicKey) {
    const user = this.usersById.get(userId);

    if (!user) {
      return null;
    }

    const nextUser = {
      ...user,
      publicKey,
      updatedAt: new Date().toISOString(),
    };

    this.usersById.set(userId, nextUser);

    return { ...nextUser };
  }
}

module.exports = {
  InMemoryUserRepository,
};
