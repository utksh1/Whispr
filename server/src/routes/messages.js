const { HttpError } = require("../errors");
const { createMessageSchema, validate } = require("../validation");
const { mutateBase64 } = require("../utils/mutate-base64");

async function requirePeer(repositories, peerUsername) {
  const peer = await repositories.users.findByUsername(peerUsername);

  if (!peer) {
    throw new HttpError(404, "peer_not_found");
  }

  return peer;
}

function serializeMessage(message) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderUsername: message.senderUsername,
    receiverUsername: message.receiverUsername,
    ciphertext: message.ciphertext,
    nonce: message.nonce,
    salt: message.salt,
    version: message.version,
    createdAt: message.createdAt,
    tampered: Boolean(message.tampered),
  };
}

function registerMessageRoutes(app, { config, repositories, io }) {
  app.get("/conversations/:peerUsername/messages", async (req, res, next) => {
    try {
      const peer = await requirePeer(repositories, req.params.peerUsername);
      const messages = await repositories.messages.listConversation(req.auth.sub, peer.id);

      res.json({
        conversationId: [req.auth.sub, peer.id].sort().join(":"),
        messages: messages.map(serializeMessage),
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/conversations/:peerUsername/messages", async (req, res, next) => {
    try {
      const input = validate(createMessageSchema, req.body);
      const sender = await repositories.users.findById(req.auth.sub);
      const peer = await requirePeer(repositories, req.params.peerUsername);

      if (!sender) {
        throw new HttpError(401, "invalid_token");
      }

      if (!sender.publicKey) {
        throw new HttpError(400, "sender_public_key_missing");
      }

      if (!peer.publicKey) {
        throw new HttpError(400, "receiver_public_key_missing");
      }

      const message = await repositories.messages.createMessage({
        senderId: sender.id,
        receiverId: peer.id,
        senderUsername: sender.username,
        receiverUsername: peer.username,
        ciphertext: input.ciphertext,
        nonce: input.nonce,
        salt: input.salt,
        version: input.version,
      });

      const serializedMessage = serializeMessage(message);

      if (!config.disableRealtime) {
        io.to(`user:${peer.id}`).emit("message:receive", serializedMessage);
        io.to(`user:${sender.id}`).emit("message:receive", serializedMessage);
      }

      res.status(201).json({
        message: serializedMessage,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/messages/:messageId/tamper", async (req, res, next) => {
    try {
      if (!config.enableDemoTools) {
        throw new HttpError(404, "route_not_found");
      }

      const existingMessage = await repositories.messages.findById(req.params.messageId);

      if (!existingMessage) {
        throw new HttpError(404, "message_not_found");
      }

      if (![existingMessage.senderId, existingMessage.receiverId].includes(req.auth.sub)) {
        throw new HttpError(403, "forbidden");
      }

      const message = await repositories.messages.markTampered(
        req.params.messageId,
        mutateBase64
      );
      const serializedMessage = serializeMessage(message);

      if (!config.disableRealtime) {
        io.to(`user:${existingMessage.senderId}`).emit("message:tampered", serializedMessage);
        io.to(`user:${existingMessage.receiverId}`).emit("message:tampered", serializedMessage);
      }

      res.json({
        message: serializedMessage,
      });
    } catch (error) {
      next(error);
    }
  });
}

module.exports = {
  registerMessageRoutes,
};
