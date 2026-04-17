export function readStoredJson(key) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(key);

    return rawValue ? JSON.parse(rawValue) : null;
  } catch {
    return null;
  }
}

export function writeStoredJson(key, value) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export function clearStoredJson(key) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(key);
}
