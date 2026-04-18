import { createClient } from "@supabase/supabase-js";

const getSupabaseUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (envUrl && envUrl.startsWith("http")) return envUrl;
  return "https://lptfbgohubujthjnerwm.supabase.co";
};

const getPublishableKey = () => {
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (envKey) return envKey;
  return ""; // Should be handled by warning below
};

export const SUPABASE_CONFIG = {
  url: getSupabaseUrl(),
  publishableKey: getPublishableKey(),
  projectRef:
    process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF?.trim() ||
    "lptfbgohubujthjnerwm",
};

if (!SUPABASE_CONFIG.publishableKey) {
  console.warn(
    "[supabase] NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing. Auth and database calls will fail until it is configured."
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
    },
  }
);
