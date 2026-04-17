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
  const port = parsePositiveInteger(process.env.PORT, 4000);
  const allowedOrigins = parseAllowedOrigins(process.env.CLIENT_ORIGIN);

  // Always allow the server's own origin and 127.0.0.1 for the Swagger UI
  const selfOrigins = [`http://localhost:${port}`, `http://127.0.0.1:${port}`];
  for (const origin of selfOrigins) {
    if (!allowedOrigins.includes(origin)) {
      allowedOrigins.push(origin);
    }
  }

  return {
    port,
    jwtSecret: normalizeString(process.env.JWT_SECRET, "whispr-dev-secret-change-me"),
    tokenTtlSeconds: parsePositiveInteger(process.env.TOKEN_TTL_SECONDS, 60 * 60 * 24 * 7),
    allowedOrigins,
    enableDemoTools: parseBoolean(process.env.ENABLE_DEMO_TOOLS),
    storageDriver: normalizeString(process.env.STORAGE_DRIVER, "filesystem"),
    storagePath: normalizeString(process.env.STORAGE_PATH, "data/db.json"),
    databaseUrl: normalizeString(process.env.DATABASE_URL),
    disableRealtime: parseBoolean(process.env.DISABLE_REALTIME),
  };
}

module.exports = {
  loadConfig,
};
