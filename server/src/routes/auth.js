const { HttpError } = require("../errors");
const { hashPassword, verifyPassword } = require("../services/passwords");
const { signToken } = require("../services/tokens");
const { loginSchema, registerSchema, validate } = require("../validation");

function serializeAuthUser(user) {
  return {
    id: user.id,
    username: user.username,
    hasPublicKey: Boolean(user.publicKey),
  };
}

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Register User
 *     description: Create a new user account and return a JWT.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully.
 */
function registerAuthRoutes(app, { config, repositories }) {
  app.post("/auth/register", async (req, res, next) => {
    try {
      const input = validate(registerSchema, req.body);
      const existingUser = await repositories.users.findByUsername(input.username);

      if (existingUser) {
        throw new HttpError(409, "username_taken");
      }

      const user = await repositories.users.createUser({
        username: input.username,
        passwordHash: await hashPassword(input.password),
      });
      const token = signToken({ sub: user.id, username: user.username }, config);

      res.status(201).json({
        token,
        user: serializeAuthUser(user),
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @openapi
   * /auth/login:
   *   post:
   *     summary: Login User
   *     description: Authenticate and receive a JWT.
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [username, password]
   *             properties:
   *               username:
   *                 type: string
   *               password:
   *                 type: string
   *     responses:
   *       200:
   *         description: Login successful.
 *       401:
 *         description: Invalid credentials.
   */
  app.post("/auth/login", async (req, res, next) => {
    try {
      const input = validate(loginSchema, req.body);
      const user = await repositories.users.findByUsername(input.username);

      if (!user) {
        throw new HttpError(401, "invalid_credentials");
      }

      const passwordMatches = await verifyPassword(input.password, user.passwordHash);

      if (!passwordMatches) {
        throw new HttpError(401, "invalid_credentials");
      }

      const token = signToken({ sub: user.id, username: user.username }, config);

      res.json({
        token,
        user: serializeAuthUser(user),
      });
    } catch (error) {
      next(error);
    }
  });

}

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Get Current User
 *     description: Retrieve the authenticated user profile.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved.
 *       401:
 *         description: Unauthorized.
 */
function registerAuthMeRoute(app, { repositories }) {
  app.get("/auth/me", async (req, res, next) => {
    try {
      const user = await repositories.users.findById(req.auth.sub);

      if (!user) {
        throw new HttpError(401, "invalid_token");
      }

      res.json({
        user: serializeAuthUser(user),
      });
    } catch (error) {
      next(error);
    }
  });
}

module.exports = {
  registerAuthRoutes,
  registerAuthMeRoute,
};
