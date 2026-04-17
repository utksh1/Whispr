require("dotenv").config();

function parseAllowedOrigins(value) {
  const normalizedValue = typeof value === "string" ? value.trim() : value;

  if (!normalizedValue) {
    return ["http://localhost:3000"];
  }

  return normalizedValue
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function parseBoolean(value) {
  return typeof value === "string" ? value.trim() === "true" : value === true;
}

function parsePositiveInteger(value, fallbackValue) {
  const parsed = Number.parseInt(typeof value === "string" ? value.trim() : value || "", 10);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallbackValue;
}

function normalizeString(value, fallbackValue = "") {
  if (typeof value !== "string") {
    return fallbackValue;
  }

  const normalized = value.trim();
  return normalized || fallbackValue;
}

function loadConfig() {
  return {
    port: parsePositiveInteger(process.env.PORT, 4000),
    jwtSecret: normalizeString(process.env.JWT_SECRET, "whispr-dev-secret-change-me"),
    tokenTtlSeconds: parsePositiveInteger(process.env.TOKEN_TTL_SECONDS, 60 * 60 * 24 * 7),
    allowedOrigins: parseAllowedOrigins(process.env.CLIENT_ORIGIN),
    enableDemoTools: parseBoolean(process.env.ENABLE_DEMO_TOOLS),
    storageDriver: normalizeString(process.env.STORAGE_DRIVER, "memory"),
    databaseUrl: normalizeString(process.env.DATABASE_URL),
    disableRealtime: parseBoolean(process.env.DISABLE_REALTIME),
  };
}

module.exports = {
  loadConfig,
};
