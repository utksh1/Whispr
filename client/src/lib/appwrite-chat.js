import { ID, Permission, Query, Role } from "appwrite";
import {
  APPWRITE_CONFIG,
  appwriteAccount,
  appwriteClient,
  appwriteDatabases,
} from "./appwrite";

const { databaseId, collections } = APPWRITE_CONFIG;

function normalizeUsername(value) {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

function conversationKeyFor(leftUserId, rightUserId) {
  return [leftUserId, rightUserId].sort().join("_");
}

function isMissingResource(error) {
  return error?.code === 404 || error?.type?.includes("not_found");
}

export function readableAppwriteError(error) {
  if (
    error?.message === "Failed to fetch" ||
    error?.name === "TypeError"
  ) {
    return "Could not reach Appwrite from this browser. Add your site as an Appwrite Web platform, allow your Vercel/localhost origin, and sign in with email instead of username.";
  }

  if (
    error?.code === 404 ||
    error?.type === "collection_not_found" ||
    error?.type === "database_not_found"
  ) {
    return `Cloud storage is connected, but Whispr's chat collections are not ready yet. Create database "${databaseId}" using Docs/10_Appwrite_Setup.md.`;
  }

  if (error?.code === 401) {
    return "Your session expired. Please log in again.";
  }

  if (error?.code === 400) {
    return error?.message || "Please check your email and password and try again.";
  }

  if (error?.code === 409) {
    return "That username or document already exists. Try logging in or pick another username.";
  }

  return error?.message || "Appwrite request failed.";
}

async function createOrUpdateDocument(collectionId, documentId, data, permissions) {
  try {
    return await appwriteDatabases.createDocument({
      databaseId,
      collectionId,
      documentId,
      data,
      permissions,
    });
  } catch (error) {
    if (!isMissingResource(error) && error?.code === 409) {
      return appwriteDatabases.updateDocument({
        databaseId,
        collectionId,
        documentId,
        data,
        permissions,
      });
    }

    throw error;
  }
}

export async function getCurrentAppwriteUser() {
  try {
    return await appwriteAccount.get();
  } catch (error) {
    if (error?.code === 401) {
      return null;
    }

    throw error;
  }
}

async function createProfile(user, username) {
  const safeUsername = normalizeUsername(username || user.name || user.email.split("@")[0]);
  const now = new Date().toISOString();

  return createOrUpdateDocument(
    collections.users,
    user.$id,
    {
      userId: user.$id,
      username: safeUsername,
      usernameLower: safeUsername,
      email: user.email,
      publicKey: "",
      activePublicKeyId: "",
      hasPublicKey: false,
      hasPrivateKeyBackup: false,
      updatedAt: now,
    },
    [
      Permission.read(Role.users()),
      Permission.update(Role.user(user.$id)),
      Permission.delete(Role.user(user.$id)),
    ]
  );
}

export async function getProfile(userId) {
  return appwriteDatabases.getDocument({
    databaseId,
    collectionId: collections.users,
    documentId: userId,
  });
}

export async function ensureProfile(user, username) {
  try {
    return await getProfile(user.$id);
  } catch (error) {
    if (isMissingResource(error)) {
      return createProfile(user, username);
    }

    throw error;
  }
}

export async function registerWithAppwrite({ email, password, username }) {
  const safeUsername = normalizeUsername(username);

  await appwriteAccount.create({
    userId: ID.unique(),
    email,
    password,
    name: safeUsername,
  });
  await appwriteAccount.createEmailPasswordSession({ email, password });

  const user = await appwriteAccount.get();
  const profile = await createProfile(user, safeUsername);

  return { user, profile };
}

export async function loginWithAppwrite({ email, password }) {
  await appwriteAccount.createEmailPasswordSession({ email, password });

  const user = await appwriteAccount.get();
  const profile = await ensureProfile(user);

  return { user, profile };
}

export async function logoutFromAppwrite() {
  try {
    await appwriteAccount.deleteSession({ sessionId: "current" });
  } catch (error) {
    if (error?.code !== 401) {
      throw error;
    }
  }
}

export async function listAppwriteUsers(query = "", currentUserId = "") {
  const normalizedQuery = normalizeUsername(query);
  const queries = [
    Query.orderAsc("usernameLower"),
    Query.limit(50),
  ];

  if (normalizedQuery) {
    queries.unshift(Query.startsWith("usernameLower", normalizedQuery));
  }

  const result = await appwriteDatabases.listDocuments({
    databaseId,
    collectionId: collections.users,
    queries,
  });

  return result.documents
    .filter((user) => user.userId !== currentUserId)
    .map((user) => ({
      id: user.userId,
      username: user.username,
      hasPublicKey: Boolean(user.publicKey),
      activePublicKeyId: user.activePublicKeyId || "",
      hasPrivateKeyBackup: Boolean(user.hasPrivateKeyBackup),
    }));
}

export async function findUserByUsername(username) {
  const safeUsername = normalizeUsername(username);
  const result = await appwriteDatabases.listDocuments({
    databaseId,
    collectionId: collections.users,
    queries: [Query.equal("usernameLower", safeUsername), Query.limit(1)],
  });

  return result.documents[0] || null;
}

export async function getActivePublicKey(username) {
  const user = await findUserByUsername(username);

  if (!user?.publicKey) {
    throw new Error("public_key_not_found");
  }

  return {
    username: user.username,
    userId: user.userId,
    publicKey: user.publicKey,
    keyId: user.activePublicKeyId,
  };
}

export async function getPublicKeyById(keyId) {
  const key = await appwriteDatabases.getDocument({
    databaseId,
    collectionId: collections.userKeys,
    documentId: keyId,
  });

  return {
    id: key.keyId || key.$id,
    username: key.username,
    userId: key.userId,
    publicKey: key.publicKey,
    isActive: Boolean(key.isActive),
    revokedAt: key.revokedAt || "",
  };
}

export async function uploadPublicKeyForUser({ user, profile, publicKey, keyId }) {
  const now = new Date().toISOString();

  if (profile?.activePublicKeyId && profile.activePublicKeyId !== keyId) {
    try {
      await appwriteDatabases.updateDocument({
        databaseId,
        collectionId: collections.userKeys,
        documentId: profile.activePublicKeyId,
        data: {
          isActive: false,
          revokedAt: now,
        },
      });
    } catch {
      // A missing historical key should not block activating the new key.
    }
  }

  await createOrUpdateDocument(
    collections.userKeys,
    keyId,
    {
      keyId,
      userId: user.$id,
      username: profile.username,
      publicKey,
      isActive: true,
      revokedAt: "",
      updatedAt: now,
    },
    [
      Permission.read(Role.users()),
      Permission.update(Role.user(user.$id)),
      Permission.delete(Role.user(user.$id)),
    ]
  );

  return appwriteDatabases.updateDocument({
    databaseId,
    collectionId: collections.users,
    documentId: user.$id,
    data: {
      publicKey,
      activePublicKeyId: keyId,
      hasPublicKey: true,
      updatedAt: now,
    },
  });
}

export async function getPrivateKeyBackup(userId) {
  try {
    return await appwriteDatabases.getDocument({
      databaseId,
      collectionId: collections.privateKeyBackups,
      documentId: userId,
    });
  } catch (error) {
    if (isMissingResource(error)) {
      return null;
    }

    throw error;
  }
}

export async function savePrivateKeyBackup(userId, backup) {
  const now = new Date().toISOString();

  await createOrUpdateDocument(
    collections.privateKeyBackups,
    userId,
    {
      userId,
      ciphertext: backup.ciphertext,
      salt: backup.salt,
      iv: backup.iv,
      version: backup.version,
      updatedAt: now,
    },
    [
      Permission.read(Role.user(userId)),
      Permission.update(Role.user(userId)),
      Permission.delete(Role.user(userId)),
    ]
  );

  return appwriteDatabases.updateDocument({
    databaseId,
    collectionId: collections.users,
    documentId: userId,
    data: {
      hasPrivateKeyBackup: true,
      updatedAt: now,
    },
  });
}

export async function createEncryptedMessage({
  sender,
  senderProfile,
  receiver,
  encryptedMessage,
}) {
  const now = new Date().toISOString();
  const conversationKey = conversationKeyFor(sender.$id, receiver.userId);

  return appwriteDatabases.createDocument({
    databaseId,
    collectionId: collections.messages,
    documentId: ID.unique(),
    data: {
      conversationKey,
      participantIds: [sender.$id, receiver.userId],
      senderId: sender.$id,
      receiverId: receiver.userId,
      senderUsername: senderProfile.username,
      receiverUsername: receiver.username,
      senderKeyId: senderProfile.activePublicKeyId,
      receiverKeyId: receiver.keyId,
      ciphertext: encryptedMessage.ciphertext,
      nonce: encryptedMessage.nonce,
      salt: encryptedMessage.salt,
      version: encryptedMessage.version,
      tampered: false,
      createdAt: now,
    },
    permissions: [
      Permission.read(Role.user(sender.$id)),
      Permission.read(Role.user(receiver.userId)),
      Permission.update(Role.user(sender.$id)),
      Permission.delete(Role.user(sender.$id)),
    ],
  });
}

export async function listConversationMessages(selfUserId, peerUserId) {
  const result = await appwriteDatabases.listDocuments({
    databaseId,
    collectionId: collections.messages,
    queries: [
      Query.equal("conversationKey", conversationKeyFor(selfUserId, peerUserId)),
      Query.orderAsc("createdAt"),
      Query.limit(100),
    ],
  });

  return result.documents.map((message) => ({
    id: message.$id,
    conversationId: message.conversationKey,
    senderKeyId: message.senderKeyId || null,
    receiverKeyId: message.receiverKeyId || null,
    senderUsername: message.senderUsername,
    receiverUsername: message.receiverUsername,
    ciphertext: message.ciphertext,
    nonce: message.nonce,
    salt: message.salt,
    version: message.version,
    createdAt: message.createdAt || message.$createdAt,
    tampered: Boolean(message.tampered),
  }));
}

export function subscribeToAppwriteMessages(onChange) {
  return appwriteClient.subscribe(
    `databases.${databaseId}.collections.${collections.messages}.documents`,
    onChange
  );
}
