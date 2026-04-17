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

function buildAssociatedData({ senderPublicKey, receiverPublicKey, version }) {
  return new TextEncoder().encode(
    JSON.stringify({
      senderPublicKey,
      receiverPublicKey,
      version,
    })
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

export async function generateLocalIdentity() {
  const keyPair = await window.crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  return {
    keyPair,
    publicKey: await exportPublicKey(keyPair.publicKey),
    ready: true,
    uploadedPublicKey: null,
  };
}

export async function hydrateStoredIdentity(storedIdentity) {
  if (!storedIdentity?.publicKey || !storedIdentity?.privateKey) {
    return generateLocalIdentity();
  }

  const publicKey = await importPublicKey(storedIdentity.publicKey);
  const privateKey = await importPrivateKey(storedIdentity.privateKey);

  return {
    publicKey: storedIdentity.publicKey,
    keyPair: {
      publicKey,
      privateKey,
    },
    ready: true,
    uploadedPublicKey: storedIdentity.uploadedPublicKey || null,
  };
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
  peerPublicKey,
  senderPublicKey,
  receiverPublicKey,
}) {
  const importedPeerKey =
    typeof peerPublicKey === "string" ? await importPublicKey(peerPublicKey) : peerPublicKey;
  const decryptionKey =
    version === "p256-hkdf-aes-gcm-v2" && salt
      ? await deriveMessageKey(selfIdentity.keyPair.privateKey, importedPeerKey, salt)
      : await deriveLegacyMessageKey(selfIdentity.keyPair.privateKey, importedPeerKey);
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
  return {
    publicKey: identity.publicKey,
    privateKey: await exportPrivateKey(identity.keyPair.privateKey),
    uploadedPublicKey: identity.uploadedPublicKey || null,
  };
}
