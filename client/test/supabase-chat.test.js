import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = {
  getUser: vi.fn(),
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
};

const removeChannelMock = vi.fn();
const subscribeMock = vi.fn(() => "subscribed");
const onMock = vi.fn();
const channelMock = vi.fn(() => ({
  on: onMock,
  subscribe: subscribeMock,
}));
const fromMock = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: authMock,
    from: fromMock,
    channel: channelMock,
    removeChannel: removeChannelMock,
  })),
}));

function makeBuilder(result = { data: null, error: null }) {
  const builder = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };

  return builder;
}

describe("supabase chat helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
    authMock.getUser.mockReset();
    authMock.signUp.mockReset();
    authMock.signInWithPassword.mockReset();
    authMock.signInWithOAuth.mockReset();
    authMock.signOut.mockReset();
    fromMock.mockReset();
    channelMock.mockClear();
    onMock.mockClear();
    subscribeMock.mockClear();
    removeChannelMock.mockClear();
    delete global.window;
  });

  it("maps common Supabase errors to user-facing messages", async () => {
    const { readableSupabaseError } = await import("../src/lib/supabase-chat");

    expect(readableSupabaseError({ message: "username_generation_failed" })).toContain(
      "unique username"
    );
    expect(readableSupabaseError({ name: "TypeError" })).toContain("Could not reach Supabase");
    expect(readableSupabaseError({ code: "42P01" })).toContain("tables are not ready");
    expect(readableSupabaseError({ status: 401 })).toContain("session expired");
    expect(readableSupabaseError({ code: "23505" })).toContain("already exists");
  });

  it("returns a normalized authenticated user and null when signed out", async () => {
    authMock.getUser.mockResolvedValueOnce({
      data: { user: { id: "user-1", email: "alice@example.com", user_metadata: { name: "Alice" } } },
      error: null,
    });

    const { getCurrentSupabaseUser } = await import("../src/lib/supabase-chat");
    await expect(getCurrentSupabaseUser()).resolves.toMatchObject({
      id: "user-1",
      $id: "user-1",
      name: "Alice",
    });

    authMock.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { status: 401 },
    });
    await expect(getCurrentSupabaseUser()).resolves.toBeNull();
  });

  it("creates a profile and falls back when the first username conflicts", async () => {
    const getProfileBuilder = makeBuilder({ data: null, error: null });
    const conflictingInsert = makeBuilder({ data: null, error: { code: "23505" } });
    const successfulInsert = makeBuilder({
      data: {
        id: "user-1",
        username: "alice-123456",
        username_lower: "alice-123456",
        email: "alice@example.com",
        public_key: "",
        active_public_key_id: "",
        has_public_key: false,
        has_private_key_backup: false,
        updated_at: "2026-04-18T00:00:00.000Z",
      },
      error: null,
    });

    fromMock
      .mockReturnValueOnce(getProfileBuilder)
      .mockReturnValueOnce(conflictingInsert)
      .mockReturnValueOnce(successfulInsert);

    const { ensureProfile } = await import("../src/lib/supabase-chat");
    const profile = await ensureProfile(
      {
        id: "user-1",
        email: "alice@example.com",
        user_metadata: { name: "Alice" },
      },
      "alice"
    );

    expect(profile.username).toBe("alice-123456");
    expect(conflictingInsert.insert).toHaveBeenCalled();
    expect(successfulInsert.insert).toHaveBeenCalled();
  });

  it("registers with email/password, logs in, and creates the profile", async () => {
    authMock.signUp.mockResolvedValueOnce({ error: null });
    authMock.signInWithPassword.mockResolvedValueOnce({
      data: {
        user: {
          id: "user-2",
          email: "eve@example.com",
          user_metadata: { username: "eve-user" },
        },
      },
      error: null,
    });

    const insertBuilder = makeBuilder({
      data: {
        id: "user-2",
        username: "eve-user",
        username_lower: "eve-user",
        email: "eve@example.com",
        public_key: "",
        active_public_key_id: "",
        has_public_key: false,
        has_private_key_backup: false,
        updated_at: "2026-04-18T00:00:00.000Z",
      },
      error: null,
    });
    fromMock.mockReturnValueOnce(insertBuilder);

    const { registerWithSupabase } = await import("../src/lib/supabase-chat");
    const result = await registerWithSupabase({
      email: "eve@example.com",
      password: "super-secret",
      username: "eve user",
    });

    expect(authMock.signUp).toHaveBeenCalled();
    expect(authMock.signInWithPassword).toHaveBeenCalledWith({
      email: "eve@example.com",
      password: "super-secret",
    });
    expect(result.profile.username).toBe("eve-user");
  });

  it("starts Google OAuth with the /app callback", async () => {
    global.window = {
      location: {
        origin: "https://whispr-client-utksh1.vercel.app",
      },
    };
    authMock.signInWithOAuth.mockResolvedValueOnce({ error: null });

    const { loginWithGoogle } = await import("../src/lib/supabase-chat");
    await loginWithGoogle();

    expect(authMock.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "https://whispr-client-utksh1.vercel.app/app?oauth=google",
      },
    });
  });

  it("lists users, filters current user, and preserves key metadata", async () => {
    const listBuilder = makeBuilder({
      data: [
        {
          id: "self",
          username: "self",
          public_key: "self-key",
          active_public_key_id: "k0",
          has_private_key_backup: true,
          has_public_key: true,
        },
        {
          id: "peer",
          username: "peer",
          public_key: "peer-key",
          active_public_key_id: "k1",
          has_private_key_backup: false,
          has_public_key: true,
        },
      ],
      error: null,
    });
    fromMock.mockReturnValueOnce(listBuilder);

    const { listSupabaseUsers } = await import("../src/lib/supabase-chat");
    const users = await listSupabaseUsers("pe", "self");

    expect(users).toEqual([
      {
        id: "peer",
        $id: "peer",
        username: "peer",
        hasPublicKey: true,
        activePublicKeyId: "k1",
        hasPrivateKeyBackup: false,
      },
    ]);
    expect(listBuilder.ilike).toHaveBeenCalledWith("username_lower", "pe%");
  });

  it("creates and lists encrypted messages", async () => {
    const insertBuilder = makeBuilder({
      data: {
        id: "msg-1",
        conversation_key: "peer-id_self-id",
        sender_key_id: "sender-key",
        receiver_key_id: "receiver-key",
        sender_username: "self",
        receiver_username: "peer",
        ciphertext: "cipher",
        nonce: "nonce",
        salt: "salt",
        version: "v1",
        created_at: "2026-04-18T00:00:00.000Z",
        tampered: false,
      },
      error: null,
    });
    const listBuilder = makeBuilder({
      data: [
        {
          id: "msg-1",
          conversation_key: "peer-id_self-id",
          sender_key_id: "sender-key",
          receiver_key_id: "receiver-key",
          sender_username: "self",
          receiver_username: "peer",
          ciphertext: "cipher",
          nonce: "nonce",
          salt: "salt",
          version: "v1",
          created_at: "2026-04-18T00:00:00.000Z",
          tampered: false,
        },
      ],
      error: null,
    });
    fromMock.mockReturnValueOnce(insertBuilder).mockReturnValueOnce(listBuilder);

    const { createEncryptedMessage, listConversationMessages } = await import(
      "../src/lib/supabase-chat"
    );

    await createEncryptedMessage({
      sender: { id: "self-id", $id: "self-id" },
      senderProfile: { username: "self", activePublicKeyId: "sender-key" },
      receiver: { userId: "peer-id", username: "peer", keyId: "receiver-key" },
      encryptedMessage: {
        ciphertext: "cipher",
        nonce: "nonce",
        salt: "salt",
        version: "v1",
      },
    });

    await expect(listConversationMessages("self-id", "peer-id")).resolves.toEqual([
      {
        id: "msg-1",
        conversationId: "peer-id_self-id",
        senderKeyId: "sender-key",
        receiverKeyId: "receiver-key",
        senderUsername: "self",
        receiverUsername: "peer",
        ciphertext: "cipher",
        nonce: "nonce",
        salt: "salt",
        version: "v1",
        createdAt: "2026-04-18T00:00:00.000Z",
        tampered: false,
      },
    ]);
  });

  it("subscribes to Supabase realtime and signs out safely", async () => {
    onMock.mockReturnValue({
      subscribe: subscribeMock,
    });
    authMock.signOut.mockResolvedValueOnce({ error: null });

    const { subscribeToSupabaseMessages, logoutFromSupabase } = await import(
      "../src/lib/supabase-chat"
    );
    const onChange = vi.fn();

    const unsubscribe = subscribeToSupabaseMessages(onChange);
    expect(channelMock).toHaveBeenCalledWith("whispr-messages");
    expect(onMock).toHaveBeenCalled();

    unsubscribe();
    expect(removeChannelMock).toHaveBeenCalled();

    await expect(logoutFromSupabase()).resolves.toBeUndefined();
    expect(authMock.signOut).toHaveBeenCalled();
  });
});
