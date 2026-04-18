export function normalizeEnvironmentValue(value) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim().replace(/^["']|["']$/g, "");

  if (!normalized) {
    return "";
  }

  const parts = normalized
    .split(/\r?\n|\\n/g)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) {
    return "";
  }

  if (parts.length > 1 && /^[A-Za-z]$/.test(parts[0])) {
    parts.shift();
  }

  return parts.join("");
}
