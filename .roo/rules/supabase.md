---
description:
globs:
alwaysApply: false
---
- **Use `@supabase/ssr` for Supabase Integration**
  - For all new and refactored Supabase client interactions within the Next.js App Router (Route Handlers, Server Components, Server Actions, Middleware), use the `@supabase/ssr` library.
  - This replaces the older `@supabase/auth-helpers-nextjs` library.
  - Refer to official `@supabase/ssr` documentation for specific client creation methods for different contexts (e.g., `createServerClient`, `createBrowserClient`).

- **Route Handlers Example (Illustrative):**
  ```typescript
  import { type CookieOptions, createServerClient } from '@supabase/ssr';
  import { cookies } from 'next/headers';
  import { NextResponse } from 'next/server';

  export async function GET(request: Request) {
    const cookieStore = cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set(name, value, options);
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.remove(name, options);
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    // ...
    return NextResponse.json({ user });
  }
  ```
  - **Note**: The `createServerClient` from `@supabase/ssr` requires you to provide `get`, `set`, and `remove` functions that interact with the `cookieStore` from `next/headers`. Ensure `CookieOptions` is imported from `@supabase/ssr` if needed for the options types.

- **Avoid `@supabase/auth-helpers-nextjs`**
  - Phase out usage of `createRouteHandlerClient`, `createServerComponentClient`, `createClientComponentClient` from `@supabase/auth-helpers-nextjs`.
  - Prioritize refactoring existing code using auth helpers to `@supabase/ssr` when feasible.
