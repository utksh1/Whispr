import { createClient } from "@supabase/supabase-js";
import { normalizeEnvironmentValue } from "./env";

const SUPABASE_URL =
  normalizeEnvironmentValue(process.env.NEXT_PUBLIC_SUPABASE_URL) ||
  "https://lptfbgohubujthjnerwm.supabase.co";

const SUPABASE_SECRET_KEY =
  normalizeEnvironmentValue(process.env.SUPABASE_SECRET_KEY) ||
  normalizeEnvironmentValue(process.env.SUPABASE_SERVICE_ROLE_KEY) ||
  "";

export function isDemoAdminEnabled() {
  const flag = normalizeEnvironmentValue(process.env.ENABLE_DEMO_ADMIN).toLowerCase();

  return process.env.NODE_ENV !== "production" || flag === "true" || flag === "1";
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
