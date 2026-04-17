const crypto = require("node:crypto");

let bcrypt;

try {
  bcrypt = require("bcryptjs");
} catch {
  bcrypt = null;
}

async function hashPassword(password) {
  if (bcrypt) {
    return bcrypt.hash(password, 10);
  }

  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex");

    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(`scrypt$${salt}$${derivedKey.toString("hex")}`);
    });
  });
}

async function verifyPassword(password, storedHash) {
  if (bcrypt && !storedHash.startsWith("scrypt$")) {
    return bcrypt.compare(password, storedHash);
  }

  const [algorithm, salt, hashValue] = storedHash.split("$");

  if (algorithm !== "scrypt" || !salt || !hashValue) {
    return false;
  }

  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      const expectedBuffer = Buffer.from(hashValue, "hex");
      const actualBuffer = Buffer.from(derivedKey.toString("hex"), "hex");
      resolve(
        expectedBuffer.length === actualBuffer.length &&
          crypto.timingSafeEqual(expectedBuffer, actualBuffer)
      );
    });
  });
}

module.exports = {
  hashPassword,
  verifyPassword,
};
