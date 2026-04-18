import { io } from "socket.io-client";
import { normalizeEnvironmentValue } from "./env";

export const API_BASE_URL =
  normalizeEnvironmentValue(process.env.NEXT_PUBLIC_API_URL).replace(/\/$/, "") ||
  "http://localhost:4000";

export const REALTIME_ENABLED =
  normalizeEnvironmentValue(process.env.NEXT_PUBLIC_DISABLE_REALTIME) !== "true";

async function apiRequest(path, options = {}) {
  const { token, headers, ...restOptions } = options;
  const safeToken = normalizeEnvironmentValue(token);
  const safeUrl = `${API_BASE_URL}${path}`;

  let response;

  try {
    response = await fetch(safeUrl, {
      headers: {
        "Content-Type": "application/json",
        ...(safeToken ? { Authorization: `Bearer ${safeToken}` } : {}),
        ...(headers || {}),
      },
      ...restOptions,
    });
  } catch (error) {
    const requestError = new Error(
      `Failed to reach Whispr API at ${safeUrl}. Check NEXT_PUBLIC_API_URL and your stored session token.`
    );
    requestError.cause = error;
    throw requestError;
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "request_failed");
  }

  return payload;
}

export function registerUser(input) {
  return apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function loginUser(input) {
  return apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getCurrentUser(token) {
  return apiRequest("/auth/me", {
    token,
  });
}

export function updateMyPublicKey(token, publicKey) {
  return apiRequest("/me/public-key", {
    method: "PUT",
    token,
    body: JSON.stringify({ publicKey }),
  });
}

export function updatePrivateKeyBackup(token, backup) {
  return apiRequest("/me/private-key-backup", {
    method: "PUT",
    token,
    body: JSON.stringify(backup),
  });
}

export function getPrivateKeyBackup(token) {
  return apiRequest("/me/private-key-backup", {
    token,
  });
}

export function listUsers(token, query = "") {
  const search = query ? `?query=${encodeURIComponent(query)}` : "";

  return apiRequest(`/users${search}`, {
    token,
  });
}

export function getUserPublicKey(token, username) {
  return apiRequest(`/users/${encodeURIComponent(username)}/public-key`, {
    token,
  });
}

export function getPublicKeyById(token, keyId) {
  return apiRequest(`/keys/${encodeURIComponent(keyId)}`, {
    token,
  });
}

export function listConversations(token) {
  return apiRequest("/conversations", {
    token,
  });
}

export function fetchConversationMessages(token, peerUsername) {
  return apiRequest(`/conversations/${encodeURIComponent(peerUsername)}/messages`, {
    token,
  });
}

export function sendConversationMessage(token, peerUsername, payload) {
  return apiRequest(`/conversations/${encodeURIComponent(peerUsername)}/messages`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export function tamperMessage(token, messageId) {
  return apiRequest(`/messages/${encodeURIComponent(messageId)}/tamper`, {
    method: "POST",
    token,
  });
}

export function createSocketClient(token) {
  if (!REALTIME_ENABLED) {
    return null;
  }

  const safeToken = normalizeEnvironmentValue(token);

  return io(API_BASE_URL, {
    transports: ["websocket"],
    auth: {
      token: safeToken,
    },
  });
}
