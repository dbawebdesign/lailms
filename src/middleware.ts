import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { isPlatformAdmin } from '@/lib/auth/platform-admin'

export async function middleware(request: NextRequest) {
  // Skip middleware entirely for image optimization and static requests to reduce log noise
  if (
    request.nextUrl.pathname.startsWith('/_next/image') ||
    request.nextUrl.pathname.startsWith('/_next/static') ||
    request.nextUrl.pathname.startsWith('/favicon') ||
    request.nextUrl.pathname.endsWith('.png') ||
    request.nextUrl.pathname.endsWith('.jpg') ||
    request.nextUrl.pathname.endsWith('.jpeg') ||
    request.nextUrl.pathname.endsWith('.gif') ||
    request.nextUrl.pathname.endsWith('.webp') ||
    request.nextUrl.pathname.endsWith('.svg') ||
    request.nextUrl.pathname.endsWith('.ico')
  ) {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Create a server client configured for middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // If the cookie is updated, update the cookies for the request and response
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          // If the cookie is removed, update the cookies for the request and response
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Refresh session if expired - important!
  await supabase.auth.getSession()

  // Enforce canceled accounts: redirect all authenticated requests to /canceled
  // Allowlist certain paths so the canceled page and its API can function
  const pathname = request.nextUrl.pathname
  let user: User | null = null
  try {
    const result = await supabase.auth.getUser()
    if (!result.error) user = result.data.user
  } catch {
    // An unavailable auth service must never open the admin boundary.
  }
  const isAdminPage = pathname === '/dev-admin' || pathname.startsWith('/dev-admin/')
  const isAdminApi = pathname === '/api/dev-admin' || pathname.startsWith('/api/dev-admin/')
  if (isAdminPage || isAdminApi) {
    const withSessionCookies = (next: NextResponse) => {
      for (const cookie of response.cookies.getAll()) next.cookies.set(cookie)
      return next
    }
    if (!user) {
      if (isAdminApi) return withSessionCookies(NextResponse.json({ error: 'Authentication required' }, { status: 401 }))
      return withSessionCookies(NextResponse.redirect(new URL('/login?next=/dev-admin', request.url)))
    }
    if (!isPlatformAdmin(user)) {
      if (isAdminApi) return withSessionCookies(NextResponse.json({ error: 'Administrator access required' }, { status: 403 }))
      return withSessionCookies(new NextResponse('Administrator access required', { status: 403 }))
    }
  }
  const isAllowedPath =
    pathname.startsWith('/canceled') ||
    pathname.startsWith('/api/account/reactivate') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/site.webmanifest') ||
    pathname.startsWith('/api/auth')

  try {
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_canceled')
        .eq('user_id', user.id)
        .single()

      if (profile?.is_canceled === true) {
        if (!pathname.startsWith('/canceled') && !isAllowedPath) {
          const url = request.nextUrl.clone()
          url.pathname = '/canceled'
          return NextResponse.redirect(url)
        }
      }
    }
  } catch (err) {
    // Fail-open to avoid blocking non-auth traffic; authenticated users will still be handled elsewhere
  }

  return response
}

// Ensure the middleware is only called for relevant paths.
export const config = {
  matcher: [
    /*
     * Match all request paths except for static files and images
     * We handle additional filtering in the middleware function itself
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
