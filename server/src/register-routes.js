const { authenticateRequest } = require("./middleware/authenticate");
const { registerAuthMeRoute, registerAuthRoutes } = require("./routes/auth");
const { registerUserRoutes } = require("./routes/users");
const { registerMessageRoutes } = require("./routes/messages");

function registerRoutes(app, { config, repositories, io }) {
  /**
   * @openapi
   * /:
   *   get:
   *     summary: Service Overview
   *     description: Public metadata entrypoint for the backend plus useful links.
   *     tags: [Meta]
   *     responses:
   *       200:
   *         description: Public service metadata.
   */
  app.get("/", (req, res) => {
    res.json({
      service: "Whispr Backend",
      status: "ok",
      docs: {
        ui: "/docs",
        openapi: "/openapi.json",
        health: "/health",
        register: "POST /auth/register",
        login: "POST /auth/login",
      },
      note: "Protected API routes require Authorization: Bearer <token>.",
    });
  });

  /**
   * @openapi
   * /health:
   *   get:
   *     summary: Health Check
   *     description: Public readiness probe for the Whispr backend.
   *     tags: [Meta]
   *     responses:
   *       200:
   *         description: Service health payload.
   */
  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      service: "Whispr Backend",
      storageDriver: config.storageDriver,
    });
  });

  registerAuthRoutes(app, { config, repositories });

  app.use(authenticateRequest(config));

  registerAuthMeRoute(app, { repositories });
  registerUserRoutes(app, { repositories });
  registerMessageRoutes(app, { config, repositories, io });
}

module.exports = {
  registerRoutes,
};
