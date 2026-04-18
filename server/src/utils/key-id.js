const crypto = require("node:crypto");

function looksLikeBase64(value) {
  const normalized = value.trim();

  if (!normalized || normalized.length % 4 !== 0) {
    return false;
  }

  return /^[A-Za-z0-9+/]+={0,2}$/.test(normalized);
}

function keyIdFor(publicKey) {
  const normalizedPublicKey = String(publicKey || "").trim();
  const keyMaterial = looksLikeBase64(normalizedPublicKey)
    ? Buffer.from(normalizedPublicKey, "base64")
    : Buffer.from(normalizedPublicKey, "utf8");

  return crypto.createHash("sha256").update(keyMaterial).digest("hex");
}

module.exports = {
  keyIdFor,
};
