import { NextResponse } from "next/server";
import { getSupabaseAdminClient, isDemoAdminEnabled } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function previewSecret(value, head = 34, tail = 14) {
  if (!value) {
    return "";
  }

  if (value.length <= head + tail + 3) {
    return value;
  }

  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

function keyId(row) {
  return row.key_id || row.id || "";
}

function mapProfile(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email || "",
    hasPublicKey: Boolean(row.has_public_key || row.active_public_key_id),
    hasPrivateKeyBackup: Boolean(row.has_private_key_backup),
    activePublicKeyId: row.active_public_key_id || "",
    publicKeyLength: row.public_key?.length || 0,
    updatedAt: row.updated_at || row.created_at || "",
  };
}

function mapKey(row) {
  const publicKey = row.public_key || "";

  return {
    keyId: keyId(row),
    userId: row.user_id,
    username: row.username || "",
    isActive: Boolean(row.is_active),
    publicKeyPreview: previewSecret(publicKey),
    publicKeyLength: publicKey.length,
    revokedAt: row.revoked_at || "",
    updatedAt: row.updated_at || row.created_at || "",
  };
}

function mapBackup(row) {
  const ciphertext = row.ciphertext || "";

  return {
    userId: row.user_id,
    version: row.version,
    ciphertextPreview: previewSecret(ciphertext),
    ciphertextLength: ciphertext.length,
    saltPreview: previewSecret(row.salt || "", 18, 8),
    ivPreview: previewSecret(row.iv || "", 18, 8),
    updatedAt: row.updated_at || "",
  };
}

function mapMessage(row) {
  const ciphertext = row.ciphertext || "";

  return {
    id: row.id,
    conversationKey: row.conversation_key || row.conversation_id || "",
    senderId: row.sender_id,
    receiverId: row.receiver_id || "",
    senderUsername: row.sender_username || "unknown",
    receiverUsername: row.receiver_username || "unknown",
    senderKeyId: row.sender_key_id || "",
    receiverKeyId: row.receiver_key_id || "",
    version: row.version,
    tampered: Boolean(row.tampered),
    createdAt: row.created_at,
    noncePreview: previewSecret(row.nonce || "", 18, 8),
    saltPreview: previewSecret(row.salt || "", 18, 8),
    ciphertextPreview: previewSecret(ciphertext, 64, 22),
    ciphertextLength: ciphertext.length,
    serverPlaintext: null,
    raw: {
      ciphertext,
      nonce: row.nonce || "",
      salt: row.salt || "",
    },
  };
}

async function selectRows(client, table, query) {
  const { data, error } = await query(client.from(table));

  if (error) {
    error.table = table;
    throw error;
  }

  return data || [];
}

export async function GET() {
  if (!isDemoAdminEnabled()) {
    return NextResponse.json(
      {
        error: "Demo admin is disabled in production.",
        setup: "Set ENABLE_DEMO_ADMIN=true only for controlled demo environments.",
      },
      { status: 403 }
    );
  }

  let supabaseAdmin;

  try {
    supabaseAdmin = getSupabaseAdminClient();
  } catch (error) {
    return NextResponse.json(
      {
        error: "SUPABASE_SECRET_KEY is missing.",
        setup: "Add SUPABASE_SECRET_KEY to client/.env.local so the server route can read demo rows without exposing the key to the browser.",
        code: error.code,
      },
      { status: 503 }
    );
  }

  try {
    const [profiles, keys, backups, messages] = await Promise.all([
      selectRows(supabaseAdmin, "profiles", (table) =>
        table
          .select("*")
          .order("updated_at", { ascending: false })
          .limit(100)
      ),
      selectRows(supabaseAdmin, "user_keys", (table) =>
        table
          .select("*")
          .order("updated_at", { ascending: false, nullsFirst: false })
          .limit(100)
      ),
      selectRows(supabaseAdmin, "private_key_backups", (table) =>
        table
          .select("*")
          .order("updated_at", { ascending: false })
          .limit(100)
      ),
      selectRows(supabaseAdmin, "messages", (table) =>
        table
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100)
      ),
    ]);

    const mappedMessages = messages.map(mapMessage);
    const mappedProfiles = profiles.map(mapProfile);
    const mappedKeys = keys.map(mapKey);
    const mappedBackups = backups.map(mapBackup);

    return NextResponse.json(
      {
        fetchedAt: new Date().toISOString(),
        notice: "Server-side admin read succeeded. Message plaintext is not present in Supabase.",
        stats: {
          profiles: mappedProfiles.length,
          publicKeys: mappedKeys.length,
          activePublicKeys: mappedKeys.filter((item) => item.isActive).length,
          encryptedBackups: mappedBackups.length,
          messages: mappedMessages.length,
          tamperedMessages: mappedMessages.filter((item) => item.tampered).length,
        },
        profiles: mappedProfiles,
        keys: mappedKeys,
        backups: mappedBackups,
        messages: mappedMessages,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error.message || "Could not read Supabase demo tables.",
        table: error.table || "",
        code: error.code || "",
      },
      { status: 500 }
    );
  }
}
