import { createClient } from "@supabase/supabase-js";

export const SUPABASE_CONFIG = {
  url:
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "https://lptfbgohubujthjnerwm.supabase.co",
  publishableKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || "",
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
