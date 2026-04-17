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

/**
 * @openapi
 * /me/public-key:
 *   put:
 *     summary: Update Public Key
 *     description: Set the current user's X25519 public key.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [publicKey]
 *             properties:
 *               publicKey:
 *                 type: string
 *     responses:
 *       200:
 *         description: Public key updated.
 */
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

  /**
   * @openapi
   * /users:
   *   get:
   *     summary: Search Users
   *     description: Find users by username.
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: query
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: List of users.
   */
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

  /**
   * @openapi
   * /users/{username}/public-key:
   *   get:
   *     summary: Get Peer Public Key
   *     description: Retrieve a target user's public key for E2EE.
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: username
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Public key retrieved.
   */
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
