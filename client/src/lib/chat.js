import { createSocketClient } from "./api";
import { decryptMessage } from "./crypto";

export async function decryptConversationMessages({
  messages,
  selfUsername,
  selfIdentity,
  resolvePublicKey,
}) {
  return Promise.all(
    messages.map(async (message) => {
      try {
        const senderPublicKey =
          message.senderUsername === selfUsername
            ? selfIdentity.publicKey
            : await resolvePublicKey(message.senderUsername);
        const receiverPublicKey =
          message.receiverUsername === selfUsername
            ? selfIdentity.publicKey
            : await resolvePublicKey(message.receiverUsername);
        const peerPublicKey =
          message.senderUsername === selfUsername ? receiverPublicKey : senderPublicKey;
        const plaintext = await decryptMessage({
          ciphertext: message.ciphertext,
          nonce: message.nonce,
          salt: message.salt,
          version: message.version,
          selfIdentity,
          peerPublicKey,
          senderPublicKey,
          receiverPublicKey,
        });

        return {
          ...message,
          plaintext,
          integrityStatus: "verified",
        };
      } catch {
        return {
          ...message,
          plaintext: "Ciphertext failed integrity verification on the client.",
          integrityStatus: "failed",
        };
      }
    })
  );
}

export function buildBackendView(messages) {
  return messages.map((message) => ({
    id: message.id,
    senderUsername: message.senderUsername,
    receiverUsername: message.receiverUsername,
    ciphertext: `${message.ciphertext.slice(0, 24)}...`,
    nonce: `${message.nonce.slice(0, 16)}...`,
    salt: message.salt ? `${message.salt.slice(0, 16)}...` : undefined,
    version: message.version,
    tampered: Boolean(message.tampered),
    createdAt: message.createdAt,
  }));
}

export function connectRealtime({
  token,
  onConnect,
  onDisconnect,
  onConnectError,
  onMessage,
  onTampered,
}) {
  const socket = createSocketClient(token);

  if (!socket) {
    onConnectError?.();
    return {
      disconnect() {},
    };
  }

  socket.on("connect", () => {
    onConnect?.();
  });
  socket.on("disconnect", () => {
    onDisconnect?.();
  });
  socket.on("connect_error", () => {
    onConnectError?.();
  });
  socket.on("message:receive", (message) => {
    onMessage?.(message);
  });
  socket.on("message:tampered", (message) => {
    onTampered?.(message);
  });

  return socket;
}
