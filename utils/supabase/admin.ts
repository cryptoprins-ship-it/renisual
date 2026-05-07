// Server-only Supabase client using the service-role key.
//
// This bypasses RLS, so it must NEVER be exported to the browser. Use
// only inside route handlers and server components that need to upload
// assets on behalf of anonymous users (where there's no logged-in
// session to attach files to) or generate signed URLs for private
// buckets (which always requires the service-role key).
//
// `SUPABASE_SERVICE_ROLE_KEY` must be set in the deploy env. Reads the
// key case-insensitively because the user names env vars in mixed case
// locally and Linux/Vercel are case-sensitive.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function readEnvCaseInsensitive(name: string): string | undefined {
  const upper = name.toUpperCase();
  for (const [k, v] of Object.entries(process.env)) {
    if (k.toUpperCase() === upper && typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

let cached: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  if (cached) return cached;
  const url = readEnvCaseInsensitive("NEXT_PUBLIC_SUPABASE_URL");
  // Supabase recently renamed service_role → "secret key". Accept both
  // so projects on either generation of the dashboard work without
  // env churn. SERVICE_ROLE_KEY wins if both are set.
  const key =
    readEnvCaseInsensitive("SUPABASE_SERVICE_ROLE_KEY") ??
    readEnvCaseInsensitive("SUPABASE_SECRET_KEY");
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!key) {
    throw new Error(
      "Set SUPABASE_SECRET_KEY (new naming) or SUPABASE_SERVICE_ROLE_KEY (legacy)",
    );
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
