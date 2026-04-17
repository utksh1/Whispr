function encodeBase64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const paddingLength = (4 - (normalized.length % 4 || 4)) % 4;
  const padded = normalized.padEnd(normalized.length + paddingLength, "=");

  return Buffer.from(padded, "base64");
}

module.exports = {
  encodeBase64Url,
  decodeBase64Url,
};
