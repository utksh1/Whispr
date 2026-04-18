const test = require("node:test");
const assert = require("node:assert/strict");
const { encodeBase64Url, decodeBase64Url } = require("../src/utils/base64url");
const { mutateBase64 } = require("../src/utils/mutate-base64");
const { keyIdFor } = require("../src/utils/key-id");
const { hashPassword, verifyPassword } = require("../src/services/passwords");
const { signToken, verifyToken, extractBearerToken } = require("../src/services/tokens");
const { HttpError } = require("../src/errors");

test("base64url helpers roundtrip utf8 values", () => {
  const source = "whispr-🔐-payload";
  const encoded = encodeBase64Url(source);

  assert.doesNotMatch(encoded, /[+=/]/);
  assert.equal(decodeBase64Url(encoded).toString("utf8"), source);
});

test("mutateBase64 flips payload bytes and keeps base64 format", () => {
  const original = Buffer.from("ciphertext").toString("base64");
  const mutated = mutateBase64(original);

  assert.notEqual(mutated, original);
  assert.equal(Buffer.from(mutated, "base64").length, Buffer.from(original, "base64").length);
  assert.equal(mutateBase64(""), "");
});

test("keyIdFor hashes equal key material consistently", () => {
  const raw = "my-public-key";
  const b64 = Buffer.from(raw, "utf8").toString("base64");

  assert.equal(keyIdFor(raw), keyIdFor(raw));
  assert.equal(keyIdFor(b64), keyIdFor(Buffer.from(raw, "utf8").toString("base64")));
  assert.match(keyIdFor(raw), /^[a-f0-9]{64}$/);
});

test("password hashing and verification works", async () => {
  const password = "strongpass123";
  const hash = await hashPassword(password);

  assert.notEqual(hash, password);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword("wrong-password", hash), false);
  assert.equal(await verifyPassword(password, "invalid-format-hash"), false);
});

test("token signing and verification validates expiry and signature", async () => {
  const config = {
    jwtSecret: "test-secret",
    tokenTtlSeconds: 60,
  };
  const token = signToken({ sub: "user-1", username: "alice" }, config);
  const payload = verifyToken(token, config);

  assert.equal(payload.sub, "user-1");
  assert.equal(payload.username, "alice");
  assert.ok(payload.iat);
  assert.ok(payload.exp > payload.iat);

  const [header, body] = token.split(".");
  const tamperedToken = `${header}.${body}.bad-signature`;
  assert.throws(() => verifyToken(tamperedToken, config), HttpError);

  const nowSeconds = Math.floor(Date.now() / 1000);
  const expired = {
    ...payload,
    exp: nowSeconds - 1,
  };
  const encodedHeader = encodeBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const encodedBody = encodeBase64Url(JSON.stringify(expired));
  const crypto = require("node:crypto");
  const signature = crypto
    .createHmac("sha256", config.jwtSecret)
    .update(`${encodedHeader}.${encodedBody}`)
    .digest("base64url");
  const expiredToken = `${encodedHeader}.${encodedBody}.${signature}`;

  assert.throws(() => verifyToken(expiredToken, config), /token_expired/);
});

test("extractBearerToken parses valid bearer header", () => {
  assert.equal(extractBearerToken("Bearer abc.123"), "abc.123");
  assert.equal(extractBearerToken("Basic token"), null);
  assert.equal(extractBearerToken("Bearer"), null);
  assert.equal(extractBearerToken(null), null);
});
