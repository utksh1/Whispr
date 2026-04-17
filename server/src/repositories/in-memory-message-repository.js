const crypto = require("node:crypto");

function conversationIdFor(userId, peerId) {
  return [userId, peerId].sort().join(":");
}

class InMemoryMessageRepository {
  constructor() {
    this.messagesByConversationId = new Map();
  }

  async createMessage({
    senderId,
    receiverId,
    senderUsername,
    receiverUsername,
    ciphertext,
    nonce,
    salt,
    version,
  }) {
    const conversationId = conversationIdFor(senderId, receiverId);
    const message = {
      id: crypto.randomUUID(),
      conversationId,
      senderId,
      receiverId,
      senderUsername,
      receiverUsername,
      ciphertext,
      nonce,
      salt,
      version,
      createdAt: new Date().toISOString(),
    };
    const existingMessages = this.messagesByConversationId.get(conversationId) || [];

    existingMessages.push(message);
    this.messagesByConversationId.set(conversationId, existingMessages);

    return { ...message };
  }

  async listConversation(userId, peerId) {
    const conversationId = conversationIdFor(userId, peerId);
    const messages = this.messagesByConversationId.get(conversationId) || [];

    return messages.map((message) => ({ ...message }));
  }

  async findById(messageId) {
    for (const messages of this.messagesByConversationId.values()) {
      const foundMessage = messages.find((message) => message.id === messageId);

      if (foundMessage) {
        return { ...foundMessage };
      }
    }

    return null;
  }

  async markTampered(messageId, mutateBase64) {
    for (const [conversationId, messages] of this.messagesByConversationId.entries()) {
      const messageIndex = messages.findIndex((message) => message.id === messageId);

      if (messageIndex === -1) {
        continue;
      }

      const message = messages[messageIndex];
      const updatedMessage = {
        ...message,
        ciphertext: mutateBase64(message.ciphertext),
        tampered: true,
        tamperedAt: new Date().toISOString(),
      };

      messages[messageIndex] = updatedMessage;
      this.messagesByConversationId.set(conversationId, messages);

      return { ...updatedMessage };
    }

    return null;
  }
}

module.exports = {
  InMemoryMessageRepository,
  conversationIdFor,
};
