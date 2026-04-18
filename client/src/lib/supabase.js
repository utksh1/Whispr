import { createClient } from "@supabase/supabase-js";
import { normalizeEnvironmentValue } from "./env";

const getSupabaseUrl = () => {
  let envUrl = normalizeEnvironmentValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (envUrl && envUrl.startsWith("http")) {
    return envUrl.replace(/\/$/, "");
  }
  return "https://lptfbgohubujthjnerwm.supabase.co";
};

const getPublishableKey = () => {
  const envKey = normalizeEnvironmentValue(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  if (envKey) return envKey;
  // Fallback to a known key for lptfbgohubujthjnerwm if possible,
  // or return a dummy that won't crash fetch
  return "MISSING_KEY";
};

export const SUPABASE_CONFIG = {
  url: getSupabaseUrl(),
  publishableKey: getPublishableKey(),
  projectRef:
    normalizeEnvironmentValue(process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF) ||
    "lptfbgohubujthjnerwm",
};

if (SUPABASE_CONFIG.publishableKey === "MISSING_KEY") {
  console.error(
    "[supabase] NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing. Building with a dummy key."
  );
}

export const supabase = createClient(
  SUPABASE_CONFIG.url,
  SUPABASE_CONFIG.publishableKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  }
);
