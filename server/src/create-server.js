const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const { Server } = require("socket.io");
const { loadConfig } = require("./config");
const { createRepositories } = require("./repositories");
const { registerRoutes } = require("./register-routes");
const { registerSocket } = require("./socket");
const { errorHandler } = require("./error-handler");
const { setupSwagger } = require("./swagger");

function buildCorsOptions(config) {
  return {
    origin(origin, callback) {
      if (!origin || config.allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("origin_not_allowed"));
    },
  };
}

function createApp() {
  const config = loadConfig();
  const repositories = createRepositories(config);
  const app = express();
  const server = http.createServer(app);
  const corsOptions = buildCorsOptions(config);
  const io = new Server(server, {
    cors: corsOptions,
  });

  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(express.json());
  setupSwagger(app, config);
  app.use(async (req, res, next) => {
    if (typeof repositories.ready === "function") {
      await repositories.ready();
    }

    next();
  });

  registerSocket(io, { config, repositories });
  registerRoutes(app, { config, repositories, io });
  app.use(errorHandler);

  return {
    app,
    server,
    io,
    config,
    repositories,
  };
}

async function createServer() {
  const appContext = createApp();

  if (typeof appContext.repositories.ready === "function") {
    await appContext.repositories.ready();
  }

  return appContext;
}

module.exports = {
  createApp,
  createServer,
};
