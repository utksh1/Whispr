const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { createServer } = require("../src/create-server");

function createApi(baseUrl) {
  return async function api(path, options = {}) {
    const { headers, ...restOptions } = options;
    const response = await fetch(`${baseUrl}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(headers || {}),
      },
      ...restOptions,
    });
    const body = await response.json();

    return { status: response.status, body };
  };
}

test("register/login/auth/message flow works and never stores plaintext", async () => {
  process.env.CLIENT_ORIGIN = "http://localhost:3000";
  process.env.ENABLE_DEMO_TOOLS = "true";
  process.env.STORAGE_DRIVER = "memory";

  const { server, repositories } = await createServer();

  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  const api = createApi(`http://127.0.0.1:${address.port}`);

  try {
    const registerAlice = await api("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username: "alice",
        password: "strongpass123",
      }),
    });

    assert.equal(registerAlice.status, 201);
    assert.ok(registerAlice.body.token);
    assert.equal(registerAlice.body.user.username, "alice");

    const storedAlice = await repositories.users.findByUsername("alice");
    assert.ok(storedAlice.passwordHash);
    assert.notEqual(storedAlice.passwordHash, "strongpass123");

    const registerBob = await api("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username: "bob",
        password: "strongpass123",
      }),
    });

    assert.equal(registerBob.status, 201);

    const badLogin = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        username: "alice",
        password: "wrongpass123",
      }),
    });

    assert.equal(badLogin.status, 401);

    const aliceHeaders = {
      Authorization: `Bearer ${registerAlice.body.token}`,
    };
    const bobHeaders = {
      Authorization: `Bearer ${registerBob.body.token}`,
    };

    const unauthenticatedMe = await api("/auth/me");
    assert.equal(unauthenticatedMe.status, 401);

    const me = await api("/auth/me", {
      headers: aliceHeaders,
    });

    assert.equal(me.status, 200);
    assert.equal(me.body.user.username, "alice");

    const alicePublicKey = await api("/me/public-key", {
      method: "PUT",
      headers: aliceHeaders,
      body: JSON.stringify({
        publicKey: "alice-public",
      }),
    });

    assert.equal(alicePublicKey.status, 200);

    const bobPublicKey = await api("/me/public-key", {
      method: "PUT",
      headers: bobHeaders,
      body: JSON.stringify({
        publicKey: "bob-public",
      }),
    });

    assert.equal(bobPublicKey.status, 200);

    const publicKeyLookup = await api("/users/bob/public-key", {
      headers: aliceHeaders,
    });

    assert.equal(publicKeyLookup.status, 200);
    assert.equal(publicKeyLookup.body.publicKey, "bob-public");

    const sendMessage = await api("/conversations/bob/messages", {
      method: "POST",
      headers: aliceHeaders,
      body: JSON.stringify({
        ciphertext: "ciphertext-value",
        nonce: "nonce-value",
        salt: "salt-value",
        version: "p256-hkdf-aes-gcm-v2",
        sender: "mallory",
      }),
    });

    assert.equal(sendMessage.status, 201);
    assert.equal(sendMessage.body.message.senderUsername, "alice");

    const messages = await api("/conversations/alice/messages", {
      headers: bobHeaders,
    });

    assert.equal(messages.status, 200);
    assert.equal(messages.body.messages.length, 1);
    assert.equal(messages.body.messages[0].ciphertext, "ciphertext-value");
    assert.equal(messages.body.messages[0].salt, "salt-value");
    assert.equal(messages.body.messages[0].version, "p256-hkdf-aes-gcm-v2");
    assert.equal(messages.body.messages[0].senderUsername, "alice");
    assert.equal(messages.body.messages[0].receiverUsername, "bob");
    assert.equal(messages.body.messages[0].plaintext, undefined);

    const tamper = await api(`/messages/${messages.body.messages[0].id}/tamper`, {
      method: "POST",
      headers: bobHeaders,
    });

    assert.equal(tamper.status, 200);
    assert.equal(tamper.body.message.tampered, true);

    process.env.ENABLE_DEMO_TOOLS = "false";
    const { server: disabledDemoServer } = await createServer();

    disabledDemoServer.listen(0, "127.0.0.1");
    await once(disabledDemoServer, "listening");

    const disabledApi = createApi(
      `http://127.0.0.1:${disabledDemoServer.address().port}`
    );
    const disabledRegister = await disabledApi("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username: "carol",
        password: "strongpass123",
      }),
    });
    const disabledTamper = await disabledApi("/messages/message-id/tamper", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${disabledRegister.body.token}`,
      },
    });

    assert.equal(disabledTamper.status, 404);
    disabledDemoServer.close();
  } finally {
    server.close();
  }
});

test("public root and health routes do not require auth", async () => {
  process.env.CLIENT_ORIGIN = "http://localhost:3000";
  process.env.STORAGE_DRIVER = "memory";

  const { server } = await createServer();

  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  const api = createApi(`http://127.0.0.1:${address.port}`);

  try {
    const root = await api("/");
    assert.equal(root.status, 200);
    assert.equal(root.body.service, "Whispr Backend");
    assert.equal(root.body.status, "ok");

    const health = await api("/health");
    assert.equal(health.status, 200);
    assert.equal(health.body.service, "Whispr Backend");
    assert.equal(health.body.status, "ok");
  } finally {
    server.close();
  }
});
