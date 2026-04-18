import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  "https://lptfbgohubujthjnerwm.supabase.co";

const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY?.trim() ||
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
  "";

export function isDemoAdminEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_DEMO_ADMIN === "true";
}

export function getSupabaseAdminClient() {
  if (!SUPABASE_SECRET_KEY) {
    const error = new Error("missing_supabase_secret_key");
    error.code = "MISSING_SUPABASE_SECRET_KEY";
    throw error;
  }

  return createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
