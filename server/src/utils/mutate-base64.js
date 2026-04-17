function mutateBase64(value) {
  const bytes = Buffer.from(value, "base64");

  if (bytes.length === 0) {
    return value;
  }

  bytes[0] ^= 0xff;
  return bytes.toString("base64");
}

module.exports = {
  mutateBase64,
};
