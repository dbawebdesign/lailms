import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

import { Database } from "../../../packages/types/db";

// Define createServerClient for server-side contexts (Route Handlers, Server Actions, Server Components)
// Passes the `cookies` function from `next/headers` directly to the Supabase client.
export const createSupabaseServerClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Try to use Next.js request-scoped cookies when available.
  // In non-Next contexts (e.g., Render worker), fall back to a plain client.
  try {
    return createServerClient<Database>(url, anon, {
      cookies: {
        async get(name: string) {
          return (await cookies()).get(name)?.value;
        },
        async set(name: string, value: string, options: CookieOptions) {
          (await cookies()).set(name, value, options);
        },
        async remove(name: string, options: CookieOptions) {
          (await cookies()).set(name, "", options);
        },
      },
    });
  } catch {
    // No request scope: build a non-cookie client. Prefer service role when present
    // so background jobs bypass RLS safely.
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || anon;
    return createClient<Database>(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
};

// Service client for server-side operations that need service role access
export const createSupabaseServiceClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // Prefer a plain client for service-role use (works in any runtime).
  return createClient<Database>(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};