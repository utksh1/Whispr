const test = require("node:test");
const assert = require("node:assert/strict");
const { InMemoryUserRepository } = require("../src/repositories/in-memory-user-repository");
const {
  InMemoryMessageRepository,
  conversationIdFor,
} = require("../src/repositories/in-memory-message-repository");

test("InMemoryUserRepository supports create, lookup, keys, backups and state hydration", async () => {
  const users = new InMemoryUserRepository();

  const alice = await users.createUser({ username: " Alice ", passwordHash: "hash-1" });
  const bob = await users.createUser({ username: "bob", passwordHash: "hash-2" });

  assert.equal(alice.username, "alice");
  assert.equal((await users.findByUsername(" ALICE ")).id, alice.id);
  assert.equal((await users.findById(bob.id)).username, "bob");

  const aliceKeyUpdate = await users.setPublicKey(alice.id, "alice-public-key-v1");
  assert.ok(aliceKeyUpdate.activePublicKeyId);

  const rotated = await users.setPublicKey(alice.id, "alice-public-key-v2");
  assert.notEqual(rotated.activePublicKeyId, aliceKeyUpdate.activePublicKeyId);

  const oldKey = await users.findPublicKeyById(aliceKeyUpdate.activePublicKeyId);
  const newKey = await users.findPublicKeyById(rotated.activePublicKeyId);
  assert.equal(oldKey.isActive, false);
  assert.equal(newKey.isActive, true);
  assert.equal(newKey.username, "alice");

  await users.setPrivateKeyBackup(alice.id, {
    ciphertext: "enc",
    salt: "salt",
    iv: "iv",
    version: "backup-v1",
  });
  const backup = await users.getPrivateKeyBackup(alice.id);
  assert.equal(backup.ciphertext, "enc");

  const search = await users.searchUsers("a");
  assert.ok(search.find((entry) => entry.username === "alice")?.hasPrivateKeyBackup);

  const snapshot = users.toState();
  const restored = new InMemoryUserRepository();
  restored.fromState(snapshot);
  assert.equal((await restored.findByUsername("alice")).activePublicKeyId, rotated.activePublicKeyId);
});

test("InMemoryMessageRepository supports messaging, tamper and conversation listing", async () => {
  const messages = new InMemoryMessageRepository();

  assert.equal(conversationIdFor("u2", "u1"), "u1:u2");

  const first = await messages.createMessage({
    senderId: "u1",
    receiverId: "u2",
    senderUsername: "alice",
    receiverUsername: "bob",
    senderKeyId: "k1",
    receiverKeyId: "k2",
    ciphertext: "cipher-1",
    nonce: "nonce-1",
    salt: "salt-1",
    version: "v2",
  });

  assert.equal(first.senderUsername, "alice");
  assert.equal(first.receiverUsername, "bob");
  assert.equal(first.receiverId, "u2");

  const listed = await messages.listConversation("u1", "u2");
  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, first.id);

  const found = await messages.findById(first.id);
  assert.equal(found.id, first.id);
  assert.equal(found.tampered, false);

  const tampered = await messages.markTampered(first.id, (value) => `${value}-tampered`);
  assert.equal(tampered.tampered, true);
  assert.equal(tampered.ciphertext, "cipher-1-tampered");
  assert.ok(tampered.tamperedAt);

  const second = await messages.createMessage({
    senderId: "u2",
    receiverId: "u1",
    senderUsername: "bob",
    receiverUsername: "alice",
    senderKeyId: "k2",
    receiverKeyId: "k1",
    ciphertext: "cipher-2",
    nonce: "nonce-2",
    salt: "salt-2",
    version: "v2",
  });

  const conversationsForAlice = await messages.listConversations("u1");
  assert.equal(conversationsForAlice.length, 1);
  assert.equal(conversationsForAlice[0].peerUsername, "bob");
  assert.equal(conversationsForAlice[0].lastMessage.ciphertext, second.ciphertext);

  const snapshot = messages.toState();
  const restored = new InMemoryMessageRepository();
  restored.fromState(snapshot);
  assert.equal((await restored.findById(first.id)).tampered, true);
});
