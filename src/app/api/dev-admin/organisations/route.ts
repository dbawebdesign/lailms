import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { Database } from '@learnologyai/types/db' // Using package name

// Define the expected structure for the user role check
interface MemberProfile {
  // Use the role enum from Database
  role: Database['public']['Enums']['role'] 
}

export async function GET(req: Request) {
  const cookieStore = await cookies()
  
  // Helper function to adapt Next.js cookies to Supabase methods
  const supabaseCookieMethods = {
    get(name: string) {
      return cookieStore.get(name)?.value
    },
    set(name: string, value: string, options: CookieOptions) {
      try {
        cookieStore.set({ name, value, ...options })
      } catch (error) {
        // Ignore error on Server Components (middleware handles refresh)
      }
    },
    remove(name: string, options: CookieOptions) {
      try {
        cookieStore.set({ name, value: '', ...options })
      } catch (error) {
         // Ignore error on Server Components (middleware handles refresh)
      }
    },
  }

  // Create client for checking user session and role
  const supabaseUserClient = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: supabaseCookieMethods } // Pass the helper methods
  )

  // Check user authentication and role
  const { data: { session }, error: sessionError } = await supabaseUserClient.auth.getSession()

  if (sessionError) {
      console.error('Error getting session:', sessionError)
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch user role from profiles table
  const { data: memberData, error: memberError } = await supabaseUserClient
    .from('profiles')
    .select('role')
    .eq('user_id', session.user.id)
    .single<MemberProfile>()

  if (memberError) {
    console.error('Error fetching member role:', memberError)
    return NextResponse.json({ error: 'Forbidden: Could not verify user role' }, { status: 403 })
  }

  if (!memberData) {
     console.error('Member data not found for user:', session.user.id)
     return NextResponse.json({ error: 'Forbidden: User profile not found' }, { status: 403 })
  }

  // --- Role Check ---
  // Using the actual Enum type from Database
  if (memberData.role !== 'super_admin') { 
    console.warn(`User ${session.user.id} attempted dev-admin access with role: ${memberData.role}`)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  // --- End Role Check ---

  // If authorized, fetch all organisations using a service role client 
  // NOTE: This requires SUPABASE_SERVICE_ROLE_KEY to be set in env
  const supabaseAdminClient = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { 
        cookies: supabaseCookieMethods, // Use the same helper methods
        auth: { 
            persistSession: false, 
            autoRefreshToken: false, 
            detectSessionInUrl: false 
        } 
      }
    )

  const { data: organisations, error: orgError } = await supabaseAdminClient
    .from('organisations')
    .select('id, name, abbr, organisation_type, created_at') 
    .order('name')

  if (orgError) {
    console.error('Error fetching organisations:', orgError)
    return NextResponse.json(
      { error: 'Failed to fetch organisations' },
      { status: 500 }
    )
  }

  return NextResponse.json(organisations)
}

// --- POST handler will be added next --- 
export async function POST(req: Request) {
  const cookieStore = await cookies()
  
  // Helper function to adapt Next.js cookies to Supabase methods - same as in GET
  const supabaseCookieMethods = {
    get(name: string) {
      return cookieStore.get(name)?.value
    },
    set(name: string, value: string, options: CookieOptions) {
      try {
        cookieStore.set({ name, value, ...options })
      } catch (error) {
        // Ignore error on Server Components (middleware handles refresh)
      }
    },
    remove(name: string, options: CookieOptions) {
      try {
        cookieStore.set({ name, value: '', ...options })
      } catch (error) {
         // Ignore error on Server Components (middleware handles refresh)
      }
    },
  }

  // Create client for checking user session and role
  const supabaseUserClient = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: supabaseCookieMethods }
  )

  // Check user authentication and role (same as in GET)
  const { data: { session }, error: sessionError } = await supabaseUserClient.auth.getSession()

  if (sessionError) {
    console.error('Error getting session:', sessionError)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch user role from profiles table
  const { data: memberData, error: memberError } = await supabaseUserClient
    .from('profiles')
    .select('role')
    .eq('user_id', session.user.id)
    .single<MemberProfile>()

  if (memberError) {
    console.error('Error fetching member role:', memberError)
    return NextResponse.json({ error: 'Forbidden: Could not verify user role' }, { status: 403 })
  }

  if (!memberData) {
    console.error('Member data not found for user:', session.user.id)
    return NextResponse.json({ error: 'Forbidden: User profile not found' }, { status: 403 })
  }

  // --- Role Check ---
  if (memberData.role !== 'super_admin') { 
    console.warn(`User ${session.user.id} attempted dev-admin access with role: ${memberData.role}`)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  // --- End Role Check ---

  // Parse and validate request body
  let body;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate required fields
  if (!body.name) {
    return NextResponse.json({ error: 'Organisation name is required' }, { status: 400 });
  }

  // Validate organization_type if provided
  const validTypes = ['Education', 'Business', 'Government', 'Homeschool'];
  if (body.organisation_type && !validTypes.includes(body.organisation_type)) {
    return NextResponse.json({ 
      error: `Invalid organisation_type. Must be one of: ${validTypes.join(', ')}` 
    }, { status: 400 });
  }

  // Create supabase admin client for creating the organization
  const supabaseAdminClient = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { 
      cookies: supabaseCookieMethods,
      auth: { 
        persistSession: false, 
        autoRefreshToken: false, 
        detectSessionInUrl: false 
      } 
    }
  )

  // Prepare organization data
  const organisationData = {
    name: body.name,
    abbr: body.abbr || null,
    organisation_type: body.organisation_type || null,
    settings: body.settings || null
  };

  // Insert the new organization
  const { data: newOrganisation, error: createError } = await supabaseAdminClient
    .from('organisations')
    .insert(organisationData)
    .select()
    .single();

  if (createError) {
    console.error('Error creating organisation:', createError);
    return NextResponse.json(
      { error: 'Failed to create organisation', details: createError.message },
      { status: 500 }
    );
  }

  return NextResponse.json(newOrganisation, { status: 201 });
} 