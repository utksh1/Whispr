const { HttpError } = require("../errors");
const { privateKeyBackupSchema, publicKeyUpdateSchema, validate } = require("../validation");

function serializeDirectoryUser(user) {
  const hasPublicKey =
    typeof user.hasPublicKey === "boolean" ? user.hasPublicKey : Boolean(user.publicKey);

  return {
    id: user.id,
    username: user.username,
    hasPublicKey,
    activePublicKeyId: user.activePublicKeyId || null,
    hasPrivateKeyBackup: Boolean(user.hasPrivateKeyBackup),
  };
}

/**
 * @openapi
 * /me/public-key:
 *   put:
 *     summary: Update Public Key
 *     description: Set or rotate the authenticated user's public key.
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
   * /me/private-key-backup:
   *   put:
   *     summary: Store Encrypted Private Key Backup
   *     description: Store client-encrypted keyring backup material. The server never receives plaintext private keys.
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/PrivateKeyBackup'
   *     responses:
   *       200:
   *         description: Encrypted backup metadata stored.
   */
  app.put("/me/private-key-backup", async (req, res, next) => {
    try {
      const input = validate(privateKeyBackupSchema, req.body);
      const backup = await repositories.users.setPrivateKeyBackup(req.auth.sub, input);

      if (!backup) {
        throw new HttpError(404, "user_not_found");
      }

      res.json({
        backup: {
          version: backup.version,
          updatedAt: backup.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @openapi
   * /me/private-key-backup:
   *   get:
   *     summary: Get Encrypted Private Key Backup
   *     description: Retrieve the authenticated user's encrypted keyring backup.
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Encrypted backup returned.
   *       404:
   *         description: Backup not found.
   */
  app.get("/me/private-key-backup", async (req, res, next) => {
    try {
      const backup = await repositories.users.getPrivateKeyBackup(req.auth.sub);

      if (!backup) {
        throw new HttpError(404, "private_key_backup_not_found");
      }

      res.json({
        backup,
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
   *     description: Find users by username prefix.
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
   *         description: List of matching users.
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
 *       404:
 *         description: Public key not found.
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
        keyId: user.activePublicKeyId,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @openapi
   * /keys/{keyId}:
   *   get:
   *     summary: Get Public Key By Id
   *     description: Retrieve an active or historical public key by deterministic key id.
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: keyId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Public key record returned.
   *       404:
   *         description: Public key not found.
   */
  app.get("/keys/:keyId", async (req, res, next) => {
    try {
      const key = await repositories.users.findPublicKeyById(req.params.keyId);

      if (!key) {
        throw new HttpError(404, "public_key_not_found");
      }

      res.json({
        key,
      });
    } catch (error) {
      next(error);
    }
  });
}

module.exports = {
  registerUserRoutes,
};
