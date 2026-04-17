const { InMemoryUserRepository } = require("./in-memory-user-repository");
const { InMemoryMessageRepository } = require("./in-memory-message-repository");
const { createPostgresRepositories } = require("./postgres-repositories");

function createRepositories(config) {
  if (config.storageDriver === "postgres") {
    return createPostgresRepositories(config);
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
