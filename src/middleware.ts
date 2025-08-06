import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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