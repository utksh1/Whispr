const fs = require("node:fs/promises");
const path = require("node:path");
const { InMemoryUserRepository } = require("./in-memory-user-repository");
const { InMemoryMessageRepository } = require("./in-memory-message-repository");

class FileSystemRepositories {
  constructor(dataFilePath) {
    this.dataFilePath = dataFilePath;
    this.users = new InMemoryUserRepository();
    this.messages = new InMemoryMessageRepository();
    this.savePromise = null;
    this.saveRequested = false;

    // Wrap the users repository methods that mutate state
    this.wrapMutation(this.users, ["createUser", "setPublicKey", "setPrivateKeyBackup"]);
    // Wrap the messages repository methods that mutate state
    this.wrapMutation(this.messages, ["createMessage", "markTampered"]);
  }

  wrapMutation(repository, methods) {
    for (const method of methods) {
      const original = repository[method].bind(repository);
      repository[method] = async (...args) => {
        const result = await original(...args);
        await this.persist();
        return result;
      };
    }
  }

  async persist() {
    if (this.savePromise) {
      this.saveRequested = true;
      return this.savePromise;
    }

    this.savePromise = (async () => {
      try {
        const state = {
          users: this.users.toState(),
          messages: this.messages.toState(),
        };
        await fs.writeFile(this.dataFilePath, JSON.stringify(state, null, 2), "utf-8");
      } catch (error) {
        console.error("Failed to persist data to filesystem", error);
      } finally {
        this.savePromise = null;
        if (this.saveRequested) {
          this.saveRequested = false;
          await this.persist();
        }
      }
    })();

    return this.savePromise;
  }

  async ready() {
    try {
      await fs.mkdir(path.dirname(this.dataFilePath), { recursive: true });
      const content = await fs.readFile(this.dataFilePath, "utf-8");
      const state = JSON.parse(content);

      if (state.users) {
        this.users.fromState(state.users);
      }
      if (state.messages) {
        this.messages.fromState(state.messages);
      }
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error("Failed to load data from filesystem", error);
      }
    }
  }
}

function createFileSystemRepositories(config) {
  const dataFilePath = path.resolve(process.cwd(), config.storagePath || "data/db.json");
  return new FileSystemRepositories(dataFilePath);
}

module.exports = {
  createFileSystemRepositories,
};
