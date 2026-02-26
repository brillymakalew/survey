import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Browser-safe singleton (lazy — avoids module-level env access during build)
let browserClient: ReturnType<typeof createSupabaseClient> | null = null;

export function createBrowserClient() {
  if (!browserClient) {
    browserClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return browserClient;
}

// Server-side client — new instance per request to avoid shared state
export function createServerClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
