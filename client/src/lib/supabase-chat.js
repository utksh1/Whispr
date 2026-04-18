import { supabase } from "./supabase";

function normalizeUsername(value) {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

function uniqueUsernameCandidates(user, requestedUsername = "") {
  const normalizedRequested = normalizeUsername(requestedUsername || "");
  const emailBase = normalizeUsername(user?.email?.split("@")[0] || "");
  const metaBase = normalizeUsername(
    user?.user_metadata?.username ||
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      ""
  );
  const fallbackBase = normalizeUsername(`whispr-${authUserId(user).slice(0, 6) || "user"}`);
  const base =
    normalizedRequested || emailBase || metaBase || fallbackBase || "whispr-user";
  const suffix = authUserId(user).slice(-6).toLowerCase() || "secure";

  return [
    base,
    `${base}-${suffix}`,
    `${base}-${suffix.slice(0, 3)}`,
    `${emailBase || "whispr"}-${suffix}`,
    fallbackBase,
  ].filter((value, index, all) => value && all.indexOf(value) === index);
}

function authUserId(user) {
  return user?.id || user?.$id || "";
}

function authDisplayName(user) {
  return (
    user?.name ||
    user?.user_metadata?.username ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Whispr User"
  );
}

function normalizeAuthUser(user) {
  if (!user) {
    return null;
  }

  return {
    ...user,
    $id: user.id,
    name: authDisplayName(user),
  };
}

function mapProfile(profile) {
  if (!profile) {
    return null;
  }

  return {
    ...profile,
    userId: profile.id,
    username: profile.username,
    usernameLower: profile.username_lower,
    publicKey: profile.public_key || "",
    activePublicKeyId: profile.active_public_key_id || "",
    hasPublicKey: Boolean(profile.has_public_key),
    hasPrivateKeyBackup: Boolean(profile.has_private_key_backup),
    updatedAt: profile.updated_at,
  };
}

function mapBackupRow(row) {
  if (!row) {
    return null;
  }

  return {
    userId: row.user_id,
    ciphertext: row.ciphertext,
    salt: row.salt,
    iv: row.iv,
    version: row.version,
    updatedAt: row.updated_at,
  };
}

function mapMessageRow(row) {
  return {
    id: row.id,
    conversationId: row.conversation_key,
    senderKeyId: row.sender_key_id || null,
    receiverKeyId: row.receiver_key_id || null,
    senderUsername: row.sender_username,
    receiverUsername: row.receiver_username,
    ciphertext: row.ciphertext,
    nonce: row.nonce,
    salt: row.salt,
    version: row.version,
    createdAt: row.created_at,
    tampered: Boolean(row.tampered),
  };
}

function isNoRowsError(error) {
  return error?.code === "PGRST116";
}

function isUniqueViolation(error) {
  return error?.code === "23505";
}

function isAuthMissing(error) {
  return error?.status === 401 || error?.code === "401" || error?.code === "PGRST301";
}

function conversationKeyFor(leftUserId, rightUserId) {
  return [leftUserId, rightUserId].sort().join("_");
}

export function readableSupabaseError(error) {
  const errorText = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();

  if (
    error?.status === 429 ||
    error?.code === "over_email_send_rate_limit" ||
    errorText.includes("email rate limit") ||
    errorText.includes("rate limit exceeded")
  ) {
    return "Supabase has rate-limited auth emails for this project. For local demos, disable email confirmations in Supabase Auth settings, or configure custom SMTP and raise the email rate limit.";
  }

  if (error?.message === "username_generation_failed") {
    return "Whispr could not reserve a unique username for this Supabase account yet. Try another username or update your Supabase profile name.";
  }

  if (error?.message === "oauth_incomplete") {
    return "Google sign-in finished, but Supabase did not return a usable session. Check your Supabase Auth redirect URLs and Google provider setup.";
  }

  if (error?.message === "public_key_not_found") {
    return "This contact has not published an active public key yet.";
  }

  if (error?.message === "Failed to fetch" || error?.name === "TypeError") {
    return "Could not reach Supabase from this browser. Confirm your Supabase URL, publishable key, and allowed redirect/origin settings.";
  }

  if (isAuthMissing(error)) {
    return "Your session expired. Please log in again.";
  }

  if (isUniqueViolation(error)) {
    return "That username or record already exists. Try logging in or choose another username.";
  }

  if (error?.code === "PGRST204" || error?.code === "42P01") {
    return "Supabase is connected, but Whispr's tables are not ready yet. Run supabase/whispr_schema.sql first.";
  }

  return error?.message || "Supabase request failed.";
}

async function createProfile(user, requestedUsername = "") {
  const now = new Date().toISOString();

  for (const safeUsername of uniqueUsernameCandidates(user, requestedUsername)) {
    const { data, error } = await supabase
      .from("profiles")
      .insert({
        id: authUserId(user),
        username: safeUsername,
        username_lower: safeUsername,
        email: user.email,
        public_key: "",
        active_public_key_id: "",
        has_public_key: false,
        has_private_key_backup: false,
        updated_at: now,
      })
      .select()
      .single();

    if (!error) {
      return mapProfile(data);
    }

    if (isUniqueViolation(error)) {
      // Check if a profile with this ID already exists
      const existing = await getProfile(authUserId(user));
      if (existing) {
        return existing;
      }
      // If no profile with this ID exists, it must be a username conflict
      continue;
    }

    throw error;
  }

  throw new Error("username_generation_failed");
}

export async function getCurrentSupabaseUser() {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    if (isAuthMissing(error)) {
      return null;
    }

    throw error;
  }

  return normalizeAuthUser(data.user);
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return mapProfile(data);
}

export async function ensureProfile(user, username = "") {
  const existing = await getProfile(authUserId(user));

  if (existing) {
    return existing;
  }

  return createProfile(user, username);
}

export async function registerWithSupabase({ email, password, username }) {
  const safeUsername = normalizeUsername(username);

  const { error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username: safeUsername,
        full_name: safeUsername,
      },
    },
  });

  if (signUpError) {
    throw signUpError;
  }

  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (loginError) {
    throw loginError;
  }

  const user = normalizeAuthUser(loginData.user);
  const profile = await createProfile(user, safeUsername);

  return { user, profile };
}

export async function loginWithSupabase({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  const user = normalizeAuthUser(data.user);
  const profile = await ensureProfile(user);

  return { user, profile };
}

export async function loginWithGoogle() {
  const appUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/app?oauth=google`
      : undefined;

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: appUrl
      ? {
          redirectTo: appUrl,
        }
      : undefined,
  });

  if (error) {
    throw error;
  }
}

export async function logoutFromSupabase() {
  const { error } = await supabase.auth.signOut();

  if (error && !isAuthMissing(error)) {
    throw error;
  }
}

export async function logoutFromAllDevices() {
  const { error } = await supabase.auth.signOut({ scope: "global" });

  if (error && !isAuthMissing(error)) {
    throw error;
  }
}

export async function listSupabaseUsers(query = "", currentUserId = "") {
  const normalizedQuery = normalizeUsername(query);
  let builder = supabase
    .from("profiles")
    .select(
      "id, username, public_key, active_public_key_id, has_private_key_backup, has_public_key"
    )
    .order("username_lower", { ascending: true })
    .limit(50);

  if (normalizedQuery) {
    builder = builder.ilike("username_lower", `${normalizedQuery}%`);
  }

  const { data, error } = await builder;

  if (error) {
    throw error;
  }

  return (data || [])
    .filter((user) => user.id !== currentUserId)
    .map((user) => ({
      id: user.id,
      $id: user.id,
      username: user.username,
      hasPublicKey: Boolean(user.has_public_key),
      activePublicKeyId: user.active_public_key_id || "",
      hasPrivateKeyBackup: Boolean(user.has_private_key_backup),
    }));
}

export async function findUserByUsername(username) {
  const safeUsername = normalizeUsername(username);
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("username_lower", safeUsername)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return mapProfile(data);
}

export async function getActivePublicKey(username) {
  const user = await findUserByUsername(username);

  if (!user?.publicKey) {
    throw new Error("public_key_not_found");
  }

  return {
    username: user.username,
    userId: user.userId,
    publicKey: user.publicKey,
    keyId: user.activePublicKeyId,
  };
}

export async function getPublicKeyById(keyId) {
  const { data, error } = await supabase
    .from("user_keys")
    .select("*")
    .eq("key_id", keyId)
    .single();

  if (error) {
    throw error;
  }

  return {
    id: data.key_id,
    username: data.username,
    userId: data.user_id,
    publicKey: data.public_key,
    isActive: Boolean(data.is_active),
    revokedAt: data.revoked_at || "",
  };
}

export async function uploadPublicKeyForUser({ user, profile, publicKey, keyId }) {
  const now = new Date().toISOString();
  const userId = authUserId(user);

  if (profile?.activePublicKeyId && profile.activePublicKeyId !== keyId) {
    const { error: revokeError } = await supabase
      .from("user_keys")
      .update({
        is_active: false,
        revoked_at: now,
      })
      .eq("key_id", profile.activePublicKeyId)
      .eq("user_id", userId);

    if (revokeError && !isNoRowsError(revokeError)) {
      throw revokeError;
    }
  }

  const { error: keyError } = await supabase
    .from("user_keys")
    .upsert(
      {
        key_id: keyId,
        user_id: userId,
        username: profile.username,
        public_key: publicKey,
        is_active: true,
        revoked_at: null,
        updated_at: now,
      },
      { onConflict: "key_id" }
    );

  if (keyError) {
    throw keyError;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      public_key: publicKey,
      active_public_key_id: keyId,
      has_public_key: true,
      updated_at: now,
    })
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return mapProfile(data);
}

export async function getPrivateKeyBackup(userId) {
  const { data, error } = await supabase
    .from("private_key_backups")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return mapBackupRow(data);
}

export async function savePrivateKeyBackup(userId, backup) {
  const now = new Date().toISOString();

  const { error: backupError } = await supabase
    .from("private_key_backups")
    .upsert(
      {
        user_id: userId,
        ciphertext: backup.ciphertext,
        salt: backup.salt,
        iv: backup.iv,
        version: backup.version,
        updated_at: now,
      },
      { onConflict: "user_id" }
    );

  if (backupError) {
    throw backupError;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      has_private_key_backup: true,
      updated_at: now,
    })
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return mapProfile(data);
}

export async function createEncryptedMessage({
  sender,
  senderProfile,
  receiver,
  encryptedMessage,
}) {
  const now = new Date().toISOString();
  const senderId = authUserId(sender);

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_key: conversationKeyFor(senderId, receiver.userId),
      participant_ids: [senderId, receiver.userId],
      sender_id: senderId,
      receiver_id: receiver.userId,
      sender_username: senderProfile.username,
      receiver_username: receiver.username,
      sender_key_id: senderProfile.activePublicKeyId,
      receiver_key_id: receiver.keyId,
      ciphertext: encryptedMessage.ciphertext,
      nonce: encryptedMessage.nonce,
      salt: encryptedMessage.salt,
      version: encryptedMessage.version,
      tampered: false,
      created_at: now,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return mapMessageRow(data);
}

export async function listConversationMessages(selfUserId, peerUserId) {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_key", conversationKeyFor(selfUserId, peerUserId))
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    throw error;
  }

  return (data || []).map(mapMessageRow);
}

export function subscribeToSupabaseMessages(onChange) {
  const channel = supabase
    .channel("whispr-messages")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "messages",
      },
      onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToSupabaseProfiles(onChange) {
  const channel = supabase
    .channel("whispr-profiles")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "profiles",
      },
      onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
