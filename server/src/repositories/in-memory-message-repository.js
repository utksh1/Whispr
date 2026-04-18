const crypto = require("node:crypto");

function conversationIdFor(userId, peerId) {
  return [userId, peerId].sort().join(":");
}

function serializeMessage(message, conversation) {
  const receiverId = conversation.participantIds.find((participantId) => participantId !== message.senderId);

  return {
    id: message.id,
    conversationId: conversation.id,
    senderId: message.senderId,
    senderKeyId: message.senderKeyId || null,
    receiverKeyId: message.receiverKeyId || null,
    receiverId,
    senderUsername: conversation.usernamesByUserId.get(message.senderId),
    receiverUsername: conversation.usernamesByUserId.get(receiverId),
    ciphertext: message.ciphertext,
    nonce: message.nonce,
    salt: message.salt,
    version: message.version,
    createdAt: message.createdAt,
    tampered: Boolean(message.tampered),
    tamperedAt: message.tamperedAt,
  };
}

class InMemoryMessageRepository {
  constructor() {
    this.conversationsByKey = new Map();
    this.messagesByConversationId = new Map();
    this.conversationIdByMessageId = new Map();
  }

  getOrCreateConversation({ senderId, receiverId, senderUsername, receiverUsername }) {
    const participantKey = conversationIdFor(senderId, receiverId);
    const existingConversation = this.conversationsByKey.get(participantKey);

    if (existingConversation) {
      existingConversation.usernamesByUserId.set(senderId, senderUsername);
      existingConversation.usernamesByUserId.set(receiverId, receiverUsername);
      return existingConversation;
    }

    const participantIds = [senderId, receiverId].sort();
    const conversation = {
      id: crypto.randomUUID(),
      participantKey,
      participantIds,
      usernamesByUserId: new Map([
        [senderId, senderUsername],
        [receiverId, receiverUsername],
      ]),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastMessageAt: null,
    };

    this.conversationsByKey.set(participantKey, conversation);
    return conversation;
  }

  async findConversationByParticipants(userId, peerId) {
    const conversation = this.conversationsByKey.get(conversationIdFor(userId, peerId));

    if (!conversation) {
      return null;
    }

    return {
      id: conversation.id,
      participantKey: conversation.participantKey,
      participantIds: [...conversation.participantIds],
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      lastMessageAt: conversation.lastMessageAt,
    };
  }

  async createMessage({
    senderId,
    receiverId,
    senderUsername,
    receiverUsername,
    senderKeyId,
    receiverKeyId,
    ciphertext,
    nonce,
    salt,
    version,
  }) {
    const conversation = this.getOrCreateConversation({
      senderId,
      receiverId,
      senderUsername,
      receiverUsername,
    });
    const createdAt = new Date().toISOString();
    const message = {
      id: crypto.randomUUID(),
      conversationId: conversation.id,
      senderId,
      senderKeyId: senderKeyId || null,
      receiverKeyId: receiverKeyId || null,
      ciphertext,
      nonce,
      salt,
      version,
      createdAt,
    };
    const existingMessages = this.messagesByConversationId.get(conversation.id) || [];

    existingMessages.push(message);
    this.messagesByConversationId.set(conversation.id, existingMessages);
    this.conversationIdByMessageId.set(message.id, conversation.id);
    conversation.updatedAt = createdAt;
    conversation.lastMessageAt = createdAt;

    return serializeMessage(message, conversation);
  }

  async listConversation(userId, peerId) {
    const conversation = this.conversationsByKey.get(conversationIdFor(userId, peerId));

    if (!conversation) {
      return [];
    }

    const messages = this.messagesByConversationId.get(conversation.id) || [];

    return messages.map((message) => serializeMessage(message, conversation));
  }

  async findById(messageId) {
    const conversationId = this.conversationIdByMessageId.get(messageId);

    if (!conversationId) {
      return null;
    }

    const messages = this.messagesByConversationId.get(conversationId) || [];
    const foundMessage = messages.find((message) => message.id === messageId);

    if (!foundMessage) {
      return null;
    }

    const conversation = [...this.conversationsByKey.values()].find(
      (existingConversation) => existingConversation.id === conversationId
    );

    return conversation ? serializeMessage(foundMessage, conversation) : null;
  }

  async markTampered(messageId, mutateBase64) {
    const conversationId = this.conversationIdByMessageId.get(messageId);

    if (!conversationId) {
      return null;
    }

    const messages = this.messagesByConversationId.get(conversationId) || [];
    const messageIndex = messages.findIndex((message) => message.id === messageId);

    if (messageIndex === -1) {
      return null;
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

    const conversation = [...this.conversationsByKey.values()].find(
      (existingConversation) => existingConversation.id === conversationId
    );

    return conversation ? serializeMessage(updatedMessage, conversation) : null;
  }

  async listConversations(userId) {
    return Array.from(this.conversationsByKey.values())
      .filter((conversation) => conversation.participantIds.includes(userId))
      .sort((a, b) => {
        const timeA = new Date(a.lastMessageAt || a.updatedAt).getTime();
        const timeB = new Date(b.lastMessageAt || b.updatedAt).getTime();
        return timeB - timeA;
      })
      .map((conversation) => {
        const peerId = conversation.participantIds.find((id) => id !== userId);
        const messages = this.messagesByConversationId.get(conversation.id) || [];
        const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

        return {
          id: conversation.id,
          peerId,
          peerUsername: conversation.usernamesByUserId.get(peerId),
          lastMessageAt: conversation.lastMessageAt,
          lastMessage: lastMessage
            ? {
                ciphertext: lastMessage.ciphertext,
                nonce: lastMessage.nonce,
                salt: lastMessage.salt,
                version: lastMessage.version,
              }
            : null,
          updatedAt: conversation.updatedAt,
        };
      });
  }

  toState() {
    return {
      conversationsByKey: Array.from(this.conversationsByKey.entries()).map(([key, conv]) => [
        key,
        {
          ...conv,
          usernamesByUserId: Array.from(conv.usernamesByUserId.entries()),
        },
      ]),
      messagesByConversationId: Array.from(this.messagesByConversationId.entries()),
      conversationIdByMessageId: Array.from(this.conversationIdByMessageId.entries()),
    };
  }

  fromState(state) {
    this.conversationsByKey = new Map(
      (state.conversationsByKey || []).map(([key, conv]) => [
        key,
        {
          ...conv,
          usernamesByUserId: new Map(conv.usernamesByUserId || []),
        },
      ])
    );
    this.messagesByConversationId = new Map(state.messagesByConversationId || []);
    this.conversationIdByMessageId = new Map(state.conversationIdByMessageId || []);
  }
}

module.exports = {
  InMemoryMessageRepository,
  conversationIdFor,
};
