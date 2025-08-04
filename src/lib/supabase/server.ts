import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

import { Database } from "../../../packages/types/db";

// Define createServerClient for server-side contexts (Route Handlers, Server Actions, Server Components)
// Passes the `cookies` function from `next/headers` directly to the Supabase client.
export const createSupabaseServerClient = () => {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // A default implementation using the `cookies` function from `next/headers`
        // can be used universally across Server Components and Route Handlers
        async get(name: string) {
          return (await cookies()).get(name)?.value;
        },
        async set(name: string, value: string, options: CookieOptions) {
          // If the cookie is updated, update the cookies for the request
          (await cookies()).set(name, value, options);
        },
        async remove(name: string, options: CookieOptions) {
          // If the cookie is removed, update the cookies for the request
          (await cookies()).set(name, "", options);
        },
      },
    }
  );
};

// Service client for server-side operations that need service role access
export const createSupabaseServiceClient = () => {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        // Service client doesn't need cookie handling
        async get() { return undefined; },
        async set() {},
        async remove() {},
      },
    }
  );
}; 