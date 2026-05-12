import { createClient } from "@supabase/supabase-js";

// Server-only. SUPABASE_SECRET_KEY is not prefixed NEXT_PUBLIC_, so Next
// will never expose it to the browser bundle.

/**
 * Admin client — bypasses RLS. Use only in server actions / route handlers
 * that have already verified the caller is a producteur.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secret) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in environment.",
    );
  }

  return createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
