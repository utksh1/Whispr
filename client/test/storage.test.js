import { describe, it, expect, beforeEach } from "vitest";
import { readStoredJson, writeStoredJson, clearStoredJson } from "../src/lib/storage";

function createLocalStorageMock() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

describe("storage helpers", () => {
  beforeEach(() => {
    global.window = {
      localStorage: createLocalStorageMock(),
    };
  });

  it("writes and reads JSON values", () => {
    writeStoredJson("identity", { user: "alice", ready: true });
    expect(readStoredJson("identity")).toEqual({ user: "alice", ready: true });
  });

  it("returns null for missing or invalid JSON", () => {
    expect(readStoredJson("missing")).toBeNull();
    window.localStorage.setItem("broken", "not-json");
    expect(readStoredJson("broken")).toBeNull();
  });

  it("clears stored keys", () => {
    writeStoredJson("token", { value: "abc" });
    clearStoredJson("token");
    expect(readStoredJson("token")).toBeNull();
  });
});
