const { HttpError } = require("../errors");
const { publicKeyUpdateSchema, validate } = require("../validation");

function serializeDirectoryUser(user) {
  const hasPublicKey =
    typeof user.hasPublicKey === "boolean" ? user.hasPublicKey : Boolean(user.publicKey);

  return {
    id: user.id,
    username: user.username,
    hasPublicKey,
  };
}

function registerUserRoutes(app, { repositories }) {
  app.put("/me/public-key", async (req, res, next) => {
    try {
      const input = validate(publicKeyUpdateSchema, req.body);
      const user = await repositories.users.setPublicKey(req.auth.sub, input.publicKey);

      if (!user) {
        throw new HttpError(404, "user_not_found");
      }

      res.json({
        user: serializeDirectoryUser(user),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/users", async (req, res, next) => {
    try {
      const query = typeof req.query.query === "string" ? req.query.query : "";
      const users = await repositories.users.searchUsers(query);
      res.json({
        users: users.map((user) => serializeDirectoryUser(user)),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/users/:username/public-key", async (req, res, next) => {
    try {
      const user = await repositories.users.findByUsername(req.params.username);

      if (!user || !user.publicKey) {
        throw new HttpError(404, "public_key_not_found");
      }

      res.json({
        username: user.username,
        publicKey: user.publicKey,
      });
    } catch (error) {
      next(error);
    }
  });
}

module.exports = {
  registerUserRoutes,
};
