import { describe, it, expect, vi, beforeEach } from "vitest";

const ioMock = vi.fn(() => ({ on: vi.fn(), disconnect: vi.fn() }));

vi.mock("socket.io-client", () => ({
  io: ioMock,
}));

describe("api client", () => {
  beforeEach(() => {
    vi.resetModules();
    ioMock.mockClear();
    global.fetch = vi.fn();
    delete process.env.NEXT_PUBLIC_DISABLE_REALTIME;
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  it("adds bearer token and returns parsed payload", async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ user: { username: "alice" } }),
    });

    const { getCurrentUser } = await import("../src/lib/api");
    const result = await getCurrentUser("jwt-token");

    expect(result.user.username).toBe("alice");
    expect(fetch).toHaveBeenCalledWith("http://localhost:4000/auth/me", {
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer jwt-token",
      },
    });
  });

  it("throws a meaningful error for non-2xx responses", async () => {
    fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "invalid_token" }),
    });

    const { getCurrentUser } = await import("../src/lib/api");
    await expect(getCurrentUser("bad-token")).rejects.toThrow("invalid_token");
  });

  it("creates socket client when realtime is enabled", async () => {
    const { createSocketClient } = await import("../src/lib/api");
    createSocketClient("abc");

    expect(ioMock).toHaveBeenCalledWith("http://localhost:4000", {
      transports: ["websocket"],
      auth: { token: "abc" },
    });
  });
});
