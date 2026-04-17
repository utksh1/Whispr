const { InMemoryUserRepository } = require("./in-memory-user-repository");
const { InMemoryMessageRepository } = require("./in-memory-message-repository");
const { createPostgresRepositories } = require("./postgres-repositories");
const { createFileSystemRepositories } = require("./filesystem-repositories");

function createRepositories(config) {
  if (config.storageDriver === "postgres") {
    return createPostgresRepositories(config);
  }

  if (config.storageDriver === "filesystem") {
    return createFileSystemRepositories(config);
  }

  return {
    users: new InMemoryUserRepository(),
    messages: new InMemoryMessageRepository(),
    async ready() {},
  };
}

module.exports = {
  createRepositories,
};
