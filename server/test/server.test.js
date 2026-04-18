const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { createServer } = require("../src/create-server");

function createApi(baseUrl) {
  async function api(path, options = {}) {
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
  }

  api.baseUrl = baseUrl;

  return api;
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
    assert.ok(alicePublicKey.body.user.activePublicKeyId);

    const bobPublicKey = await api("/me/public-key", {
      method: "PUT",
      headers: bobHeaders,
      body: JSON.stringify({
        publicKey: "bob-public",
      }),
    });

    assert.equal(bobPublicKey.status, 200);
    assert.ok(bobPublicKey.body.user.activePublicKeyId);

    const aliceBackup = await api("/me/private-key-backup", {
      method: "PUT",
      headers: aliceHeaders,
      body: JSON.stringify({
        ciphertext: "encrypted-keyring",
        salt: "backup-salt",
        iv: "backup-iv",
        version: "backup-pbkdf2-aes-gcm-v1",
      }),
    });

    assert.equal(aliceBackup.status, 200);

    const fetchedBackup = await api("/me/private-key-backup", {
      headers: aliceHeaders,
    });

    assert.equal(fetchedBackup.status, 200);
    assert.equal(fetchedBackup.body.backup.ciphertext, "encrypted-keyring");
    assert.equal(fetchedBackup.body.backup.privateKey, undefined);
    assert.equal(fetchedBackup.body.backup.plaintext, undefined);

    const unauthenticatedBackup = await api("/me/private-key-backup");
    assert.equal(unauthenticatedBackup.status, 401);

    const bobCannotReadAliceBackup = await api("/me/private-key-backup", {
      headers: bobHeaders,
    });
    assert.equal(bobCannotReadAliceBackup.status, 404);

    const publicKeyLookup = await api("/users/bob/public-key", {
      headers: aliceHeaders,
    });

    assert.equal(publicKeyLookup.status, 200);
    assert.equal(publicKeyLookup.body.publicKey, "bob-public");
    assert.ok(publicKeyLookup.body.keyId);

    const keyLookup = await api(`/keys/${publicKeyLookup.body.keyId}`, {
      headers: aliceHeaders,
    });

    assert.equal(keyLookup.status, 200);
    assert.equal(keyLookup.body.key.publicKey, "bob-public");
    assert.equal(keyLookup.body.key.privateKey, undefined);

    const rotatedBobPublicKey = await api("/me/public-key", {
      method: "PUT",
      headers: bobHeaders,
      body: JSON.stringify({
        publicKey: "bob-public-v2",
      }),
    });

    assert.equal(rotatedBobPublicKey.status, 200);
    assert.notEqual(
      rotatedBobPublicKey.body.user.activePublicKeyId,
      bobPublicKey.body.user.activePublicKeyId
    );

    const oldBobKeyLookup = await api(`/keys/${bobPublicKey.body.user.activePublicKeyId}`, {
      headers: aliceHeaders,
    });

    assert.equal(oldBobKeyLookup.status, 200);
    assert.equal(oldBobKeyLookup.body.key.publicKey, "bob-public");

    const currentBobKeyLookup = await api("/users/bob/public-key", {
      headers: aliceHeaders,
    });

    assert.equal(currentBobKeyLookup.status, 200);
    assert.equal(currentBobKeyLookup.body.publicKey, "bob-public-v2");
    assert.equal(currentBobKeyLookup.body.keyId, rotatedBobPublicKey.body.user.activePublicKeyId);

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
    assert.match(sendMessage.body.message.conversationId, /^[0-9a-f-]{36}$/i);
    assert.ok(sendMessage.body.message.senderKeyId);
    assert.ok(sendMessage.body.message.receiverKeyId);

    const storedConversationMessages = [
      ...repositories.messages.messagesByConversationId.values(),
    ][0];

    assert.equal(repositories.messages.conversationsByKey.size, 1);
    assert.equal(storedConversationMessages.length, 1);
    assert.equal(storedConversationMessages[0].senderUsername, undefined);
    assert.equal(storedConversationMessages[0].receiverUsername, undefined);
    assert.equal(storedConversationMessages[0].receiverId, undefined);

    const messages = await api("/conversations/alice/messages", {
      headers: bobHeaders,
    });

    assert.equal(messages.status, 200);
    assert.equal(messages.body.conversationId, sendMessage.body.message.conversationId);
    assert.equal(messages.body.messages.length, 1);
    assert.equal(messages.body.messages[0].ciphertext, "ciphertext-value");
    assert.equal(messages.body.messages[0].salt, "salt-value");
    assert.equal(messages.body.messages[0].version, "p256-hkdf-aes-gcm-v2");
    assert.equal(messages.body.messages[0].senderUsername, "alice");
    assert.equal(messages.body.messages[0].receiverUsername, "bob");
    assert.equal(messages.body.messages[0].senderKeyId, alicePublicKey.body.user.activePublicKeyId);
    assert.equal(messages.body.messages[0].receiverKeyId, rotatedBobPublicKey.body.user.activePublicKeyId);
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
    assert.equal(root.body.docs.ui, "/docs");
    assert.equal(root.body.docs.openapi, "/openapi.json");

    const health = await api("/health");
    assert.equal(health.status, 200);
    assert.equal(health.body.service, "Whispr Backend");
    assert.equal(health.body.status, "ok");

    const openApi = await api("/openapi.json");
    assert.equal(openApi.status, 200);
    assert.equal(openApi.body.openapi, "3.0.0");
    assert.equal(openApi.body.info.title, "Whispr API");
    assert.ok(openApi.body.paths["/auth/register"]);
    assert.ok(openApi.body.paths["/health"]);
    assert.ok(openApi.body.paths["/me/private-key-backup"]);
    assert.ok(openApi.body.paths["/keys/{keyId}"]);
    assert.ok(openApi.body.components.schemas.PrivateKeyBackup);
    assert.ok(openApi.body.components.schemas.PublicKeyRecord);

    const docsResponse = await fetch(`${api.baseUrl}/docs/`);
    const docsHtml = await docsResponse.text();
    assert.equal(docsResponse.status, 200);
    assert.match(docsResponse.headers.get("content-type"), /text\/html/);
    assert.match(docsHtml, /SwaggerUIBundle/);
  } finally {
    server.close();
  }
});
