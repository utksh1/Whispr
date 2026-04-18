function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return window.btoa(binary);
}

function base64ToUint8Array(value) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function toArrayBuffer(value) {
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
}

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function buildAssociatedData({ senderPublicKey, receiverPublicKey, version }) {
  return new TextEncoder().encode(
    JSON.stringify({
      senderPublicKey,
      receiverPublicKey,
      version,
    })
  );
}

async function importStoredKeyEntry(entry) {
  const publicKey = await importPublicKey(entry.publicKey);
  const privateKey = await importPrivateKey(entry.privateKey);

  return {
    keyId: entry.keyId || (await deriveKeyId(entry.publicKey)),
    publicKey: entry.publicKey,
    keyPair: {
      publicKey,
      privateKey,
    },
  };
}

function dedupeKeyring(entries) {
  const byKeyId = new Map();

  entries.forEach((entry) => {
    if (entry?.keyId) {
      byKeyId.set(entry.keyId, entry);
    }
  });

  return Array.from(byKeyId.values());
}

function withActiveIdentity(keyring, currentKeyId, uploadedPublicKey = null, uploadedKeyId = null) {
  const activeEntry = keyring.find((entry) => entry.keyId === currentKeyId) || keyring[0] || null;

  return {
    ready: true,
    currentKeyId: activeEntry?.keyId || null,
    publicKey: activeEntry?.publicKey || "",
    keyPair: activeEntry?.keyPair || null,
    keyring,
    uploadedPublicKey: uploadedPublicKey || null,
    uploadedKeyId: uploadedKeyId || null,
  };
}

async function deriveBackupKey(password, salt) {
  const passwordKey = await window.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: base64ToUint8Array(salt),
      iterations: 150000,
      hash: "SHA-256",
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function exportPublicKey(key) {
  const rawKey = await window.crypto.subtle.exportKey("raw", key);
  return arrayBufferToBase64(rawKey);
}

export async function exportPrivateKey(key) {
  const rawKey = await window.crypto.subtle.exportKey("pkcs8", key);
  return arrayBufferToBase64(rawKey);
}

export async function importPublicKey(rawKey) {
  return window.crypto.subtle.importKey(
    "raw",
    base64ToUint8Array(rawKey),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
}

export async function importPrivateKey(rawKey) {
  return window.crypto.subtle.importKey(
    "pkcs8",
    base64ToUint8Array(rawKey),
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );
}

export async function deriveKeyId(publicKey) {
  const digest = await window.crypto.subtle.digest("SHA-256", base64ToUint8Array(publicKey));
  return bytesToHex(new Uint8Array(digest));
}

export function findIdentityKey(identity, keyId) {
  if (!identity?.keyring?.length) {
    return null;
  }

  if (!keyId) {
    return identity.keyring.find((entry) => entry.keyId === identity.currentKeyId) || null;
  }

  return identity.keyring.find((entry) => entry.keyId === keyId) || null;
}

export async function generateLocalIdentity(existingIdentity = null) {
  const keyPair = await window.crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );
  const publicKey = await exportPublicKey(keyPair.publicKey);
  const keyId = await deriveKeyId(publicKey);
  const existingKeyring = existingIdentity?.keyring || [];
  const keyring = dedupeKeyring([
    ...existingKeyring,
    {
      keyId,
      publicKey,
      keyPair,
    },
  ]);

  return withActiveIdentity(
    keyring,
    keyId,
    existingIdentity?.uploadedPublicKey || null,
    existingIdentity?.uploadedKeyId || null
  );
}

export async function hydrateStoredIdentity(storedIdentity) {
  if (!storedIdentity?.publicKey || !storedIdentity?.privateKey) {
    return generateLocalIdentity();
  }

  const storedKeyring = storedIdentity.keyring?.length
    ? storedIdentity.keyring
    : [
        {
          keyId: storedIdentity.currentKeyId || storedIdentity.uploadedKeyId || null,
          publicKey: storedIdentity.publicKey,
          privateKey: storedIdentity.privateKey,
        },
      ];
  const importedKeyring = [];

  for (const entry of storedKeyring) {
    importedKeyring.push(await importStoredKeyEntry(entry));
  }

  const currentKeyId =
    storedIdentity.currentKeyId ||
    importedKeyring.find((entry) => entry.publicKey === storedIdentity.publicKey)?.keyId ||
    importedKeyring[0]?.keyId ||
    null;

  return withActiveIdentity(
    importedKeyring,
    currentKeyId,
    storedIdentity.uploadedPublicKey || null,
    storedIdentity.uploadedKeyId || null
  );
}

export async function deriveLegacyMessageKey(privateKey, publicKey) {
  const sharedSecret = await window.crypto.subtle.deriveBits(
    { name: "ECDH", public: publicKey },
    privateKey,
    256
  );
  const keyMaterial = await window.crypto.subtle.digest("SHA-256", sharedSecret);

  return window.crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function deriveMessageKey(privateKey, publicKey, salt) {
  const sharedSecret = await window.crypto.subtle.deriveBits(
    { name: "ECDH", public: publicKey },
    privateKey,
    256
  );
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    sharedSecret,
    "HKDF",
    false,
    ["deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: base64ToUint8Array(salt),
      info: new TextEncoder().encode("whispr-message-key"),
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptMessage({ plaintext, senderIdentity, receiverPublicKey }) {
  const receiverKey =
    typeof receiverPublicKey === "string"
      ? await importPublicKey(receiverPublicKey)
      : receiverPublicKey;
  const version = "p256-hkdf-aes-gcm-v2";
  const salt = arrayBufferToBase64(window.crypto.getRandomValues(new Uint8Array(16)));
  const encryptionKey = await deriveMessageKey(
    senderIdentity.keyPair.privateKey,
    receiverKey,
    salt
  );
  const nonce = window.crypto.getRandomValues(new Uint8Array(12));
  const senderPublicKey = senderIdentity.publicKey;
  const receiverPublicKeyValue =
    typeof receiverPublicKey === "string"
      ? receiverPublicKey
      : await exportPublicKey(receiverKey);
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: nonce,
      additionalData: toArrayBuffer(
        buildAssociatedData({
          senderPublicKey,
          receiverPublicKey: receiverPublicKeyValue,
          version,
        })
      ),
    },
    encryptionKey,
    new TextEncoder().encode(plaintext)
  );

  return {
    ciphertext: arrayBufferToBase64(encrypted),
    nonce: arrayBufferToBase64(nonce),
    salt,
    version,
  };
}

export async function decryptMessage({
  ciphertext,
  nonce,
  salt,
  version,
  selfIdentity,
  privateKey,
  peerPublicKey,
  senderPublicKey,
  receiverPublicKey,
}) {
  const importedPeerKey =
    typeof peerPublicKey === "string" ? await importPublicKey(peerPublicKey) : peerPublicKey;
  const localPrivateKey = privateKey || selfIdentity?.keyPair?.privateKey;
  const decryptionKey =
    version === "p256-hkdf-aes-gcm-v2" && salt
      ? await deriveMessageKey(localPrivateKey, importedPeerKey, salt)
      : await deriveLegacyMessageKey(localPrivateKey, importedPeerKey);
  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToUint8Array(nonce),
      additionalData:
        version === "p256-hkdf-aes-gcm-v2"
          ? toArrayBuffer(
              buildAssociatedData({
                senderPublicKey,
                receiverPublicKey,
                version,
              })
            )
          : undefined,
    },
    decryptionKey,
    base64ToUint8Array(ciphertext)
  );

  return new TextDecoder().decode(decrypted);
}

export async function serializeIdentity(identity) {
  const keyring = identity?.keyring?.length
    ? identity.keyring
    : [
        {
          keyId: identity.currentKeyId || (identity.publicKey ? await deriveKeyId(identity.publicKey) : null),
          publicKey: identity.publicKey,
          keyPair: identity.keyPair,
        },
      ].filter((entry) => entry.publicKey && entry.keyPair);

  const serializedKeyring = [];

  for (const entry of keyring) {
    serializedKeyring.push({
      keyId: entry.keyId,
      publicKey: entry.publicKey,
      privateKey: await exportPrivateKey(entry.keyPair.privateKey),
    });
  }

  const activeEntry = findIdentityKey(identity, identity.currentKeyId) || keyring[0] || null;

  return {
    currentKeyId: activeEntry?.keyId || null,
    publicKey: activeEntry?.publicKey || "",
    privateKey: activeEntry ? await exportPrivateKey(activeEntry.keyPair.privateKey) : "",
    keyring: serializedKeyring,
    uploadedPublicKey: identity.uploadedPublicKey || null,
    uploadedKeyId: identity.uploadedKeyId || null,
  };
}

export async function encryptIdentityBackup(identity, password) {
  const serializedIdentity = await serializeIdentity(identity);
  const salt = arrayBufferToBase64(window.crypto.getRandomValues(new Uint8Array(16)));
  const iv = arrayBufferToBase64(window.crypto.getRandomValues(new Uint8Array(12)));
  const backupKey = await deriveBackupKey(password, salt);
  const ciphertext = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: base64ToUint8Array(iv),
    },
    backupKey,
    new TextEncoder().encode(JSON.stringify(serializedIdentity))
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertext),
    salt,
    iv,
    version: "backup-pbkdf2-aes-gcm-v1",
  };
}

export async function decryptIdentityBackup(backup, password) {
  const backupKey = await deriveBackupKey(password, backup.salt);
  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToUint8Array(backup.iv),
    },
    backupKey,
    base64ToUint8Array(backup.ciphertext)
  );

  return hydrateStoredIdentity(JSON.parse(new TextDecoder().decode(decrypted)));
}
