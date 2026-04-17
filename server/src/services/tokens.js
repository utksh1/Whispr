const crypto = require("node:crypto");
const { encodeBase64Url, decodeBase64Url } = require("../utils/base64url");
const { HttpError } = require("../errors");

function signToken(payload, config) {
  const header = {
    alg: "HS256",
    typ: "JWT",
  };
  const issuedAt = Math.floor(Date.now() / 1000);
  const body = {
    ...payload,
    iat: issuedAt,
    exp: issuedAt + config.tokenTtlSeconds,
  };
  const encodedHeader = encodeBase64Url(JSON.stringify(header));
  const encodedBody = encodeBase64Url(JSON.stringify(body));
  const signature = crypto
    .createHmac("sha256", config.jwtSecret)
    .update(`${encodedHeader}.${encodedBody}`)
    .digest("base64url");

  return `${encodedHeader}.${encodedBody}.${signature}`;
}

function verifyToken(token, config) {
  if (!token || typeof token !== "string") {
    throw new HttpError(401, "missing_token");
  }

  const parts = token.split(".");

  if (parts.length !== 3) {
    throw new HttpError(401, "invalid_token");
  }

  const [encodedHeader, encodedBody, providedSignature] = parts;
  const expectedSignature = crypto
    .createHmac("sha256", config.jwtSecret)
    .update(`${encodedHeader}.${encodedBody}`)
    .digest("base64url");

  if (
    expectedSignature.length !== providedSignature.length ||
    !crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(providedSignature))
  ) {
    throw new HttpError(401, "invalid_token");
  }

  let payload;

  try {
    payload = JSON.parse(decodeBase64Url(encodedBody).toString("utf8"));
  } catch {
    throw new HttpError(401, "invalid_token");
  }

  const currentTime = Math.floor(Date.now() / 1000);

  if (!payload.exp || payload.exp <= currentTime) {
    throw new HttpError(401, "token_expired");
  }

  return payload;
}

function extractBearerToken(headerValue) {
  if (!headerValue || typeof headerValue !== "string") {
    return null;
  }

  const [scheme, token] = headerValue.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

module.exports = {
  signToken,
  verifyToken,
  extractBearerToken,
};
