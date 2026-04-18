import { createSocketClient } from "./api";
import { decryptMessage, findIdentityKey } from "./crypto";

function uniqueValues(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function candidateLocalKeys(identity, preferredKeyId) {
  const keyring = identity?.keyring || [];
  const preferredKey = preferredKeyId ? findIdentityKey(identity, preferredKeyId) : null;
  const activeKey = findIdentityKey(identity, identity?.currentKeyId);

  return uniqueValues([
    preferredKey?.keyId,
    activeKey?.keyId,
    ...keyring.map((entry) => entry.keyId),
  ])
    .map((keyId) => findIdentityKey(identity, keyId))
    .filter((entry) => entry?.keyPair?.privateKey);
}

async function candidatePeerPublicKeys({ username, keyId, resolvePublicKey }) {
  const candidates = [];

  if (keyId) {
    try {
      candidates.push(await resolvePublicKey({ username, keyId }));
    } catch {
      // Keep trying active key fallback for legacy or partially migrated messages.
    }
  }

  try {
    candidates.push(await resolvePublicKey({ username, keyId: null }));
  } catch {
    // The caller will surface missing-key/integrity state if no candidate works.
  }

  return uniqueValues(candidates);
}

export async function decryptConversationMessages({
  messages,
  selfUsername,
  selfIdentity,
  resolvePublicKey,
}) {
  return Promise.all(
    messages.map(async (message) => {
      try {
        const isSenderSelf = message.senderUsername === selfUsername;
        const selfKeyId = isSenderSelf ? message.senderKeyId : message.receiverKeyId;
        const peerKeyId = isSenderSelf ? message.receiverKeyId : message.senderKeyId;
        const peerUsername = isSenderSelf ? message.receiverUsername : message.senderUsername;
        const localKeyEntries = candidateLocalKeys(selfIdentity, selfKeyId);
        const peerPublicKeys = await candidatePeerPublicKeys({
          username: peerUsername,
          keyId: peerKeyId,
          resolvePublicKey,
        });

        if (localKeyEntries.length === 0 || peerPublicKeys.length === 0) {
          throw new Error("private_key_unavailable_for_message");
        }

        for (const localKeyEntry of localKeyEntries) {
          for (const peerPublicKey of peerPublicKeys) {
            const senderPublicKey = isSenderSelf ? localKeyEntry.publicKey : peerPublicKey;
            const receiverPublicKey = isSenderSelf ? peerPublicKey : localKeyEntry.publicKey;

            try {
              const plaintext = await decryptMessage({
                ciphertext: message.ciphertext,
                nonce: message.nonce,
                salt: message.salt,
                version: message.version,
                privateKey: localKeyEntry.keyPair.privateKey,
                peerPublicKey,
                senderPublicKey,
                receiverPublicKey,
              });

              return {
                ...message,
                plaintext,
                sender: isSenderSelf ? "me" : "peer",
                integrityStatus: "verified",
              };
            } catch {
              // Try the next key pair/public key candidate before declaring failure.
            }
          }
        }

        if (!selfKeyId || (selfKeyId && !findIdentityKey(selfIdentity, selfKeyId))) {
          throw new Error("private_key_unavailable_for_message");
        }

        throw new Error("message_integrity_verification_failed");
      } catch (error) {
        if (
          error.message === "private_key_unavailable_for_message" &&
          !message.tampered
        ) {
          return {
            ...message,
            sender: message.senderUsername === selfUsername ? "me" : "peer",
            plaintext:
              "Missing the old private key for this message. Restore your encrypted key backup or use the original device to read it.",
            integrityStatus: "missing-key",
          };
        }

        return {
          ...message,
          sender: message.senderUsername === selfUsername ? "me" : "peer",
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
    senderKeyId: message.senderKeyId,
    receiverKeyId: message.receiverKeyId,
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
