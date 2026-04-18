const test = require("node:test");
const assert = require("node:assert/strict");
const { loadConfig } = require("../src/config");
const { validate, registerSchema } = require("../src/validation");
const { HttpError } = require("../src/errors");
const { errorHandler } = require("../src/error-handler");
const { authenticateRequest, authenticateSocket } = require("../src/middleware/authenticate");
const { signToken } = require("../src/services/tokens");

function withEnv(overrides, fn) {
  const snapshot = {
    PORT: process.env.PORT,
    CLIENT_ORIGIN: process.env.CLIENT_ORIGIN,
    JWT_SECRET: process.env.JWT_SECRET,
    TOKEN_TTL_SECONDS: process.env.TOKEN_TTL_SECONDS,
    ENABLE_DEMO_TOOLS: process.env.ENABLE_DEMO_TOOLS,
    STORAGE_DRIVER: process.env.STORAGE_DRIVER,
    STORAGE_PATH: process.env.STORAGE_PATH,
    DATABASE_URL: process.env.DATABASE_URL,
    DISABLE_REALTIME: process.env.DISABLE_REALTIME,
  };

  Object.assign(process.env, overrides);
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [key, value] of Object.entries(snapshot)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    });
}

test("loadConfig applies defaults and normalizes values", async () => {
  await withEnv(
    {
      PORT: " 5050 ",
      CLIENT_ORIGIN: "https://a.com, https://b.com",
      JWT_SECRET: "  secret  ",
      TOKEN_TTL_SECONDS: " 3600 ",
      ENABLE_DEMO_TOOLS: "true",
      STORAGE_DRIVER: " filesystem ",
      STORAGE_PATH: " data/my-db.json ",
      DATABASE_URL: " postgres://localhost/db ",
      DISABLE_REALTIME: "true",
    },
    () => {
      const config = loadConfig();
      assert.equal(config.port, 5050);
      assert.equal(config.jwtSecret, "secret");
      assert.equal(config.tokenTtlSeconds, 3600);
      assert.equal(config.enableDemoTools, true);
      assert.equal(config.storageDriver, "filesystem");
      assert.equal(config.storagePath, "data/my-db.json");
      assert.equal(config.databaseUrl, "postgres://localhost/db");
      assert.equal(config.disableRealtime, true);
      assert.ok(config.allowedOrigins.includes("https://a.com"));
      assert.ok(config.allowedOrigins.includes("https://b.com"));
      assert.ok(config.allowedOrigins.includes("http://localhost:5050"));
      assert.ok(config.allowedOrigins.includes("http://127.0.0.1:5050"));
    }
  );
});

test("validate returns parsed data and throws invalid_request", () => {
  const valid = validate(registerSchema, { username: " Alice ", password: "strongpass123" });
  assert.equal(valid.username, "Alice");

  assert.throws(
    () => validate(registerSchema, { username: "a", password: "123" }),
    (error) => error instanceof HttpError && error.statusCode === 400 && error.code === "invalid_request"
  );
});

test("errorHandler formats known errors and fallback internal errors", () => {
  const responses = [];
  const res = {
    headersSent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      responses.push({ statusCode: this.statusCode, payload });
    },
  };

  errorHandler(new HttpError(401, "missing_token"), {}, res, () => {});
  assert.deepEqual(responses[0], {
    statusCode: 401,
    payload: { error: "missing_token" },
  });

  const issueDetails = JSON.stringify([{ path: ["username"], message: "too_short" }]);
  errorHandler(new HttpError(400, "invalid_request", issueDetails), {}, res, () => {});
  assert.deepEqual(responses[1], {
    statusCode: 400,
    payload: { error: "invalid_request", details: [{ path: ["username"], message: "too_short" }] },
  });
});

test("authenticateRequest attaches auth payload on valid token", () => {
  const config = { jwtSecret: "secret", tokenTtlSeconds: 600 };
  const token = signToken({ userId: "u-1" }, config);
  const req = { headers: { authorization: `Bearer ${token}` } };
  let nextError = undefined;
  const middleware = authenticateRequest(config);

  middleware(req, {}, (error) => {
    nextError = error;
  });

  assert.equal(nextError, undefined);
  assert.equal(req.auth.userId, "u-1");
});

test("authenticateSocket reads token from auth and handles missing token", () => {
  const config = { jwtSecret: "secret", tokenTtlSeconds: 600 };
  const token = signToken({ userId: "sock-1" }, config);
  const middleware = authenticateSocket(config);

  const socket = { handshake: { auth: { token }, headers: {} }, data: {} };
  let validError;
  middleware(socket, (error) => {
    validError = error;
  });
  assert.equal(validError, undefined);
  assert.equal(socket.data.auth.userId, "sock-1");

  const missingSocket = { handshake: { auth: {}, headers: {} }, data: {} };
  let missingError;
  middleware(missingSocket, (error) => {
    missingError = error;
  });
  assert.equal(missingError?.code, "missing_token");
});
