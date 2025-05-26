import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { type CookieOptions, createServerClient } from '@supabase/ssr';
import { BaseClassCreationData, BaseClass } from '@/types/teach'; // BaseClass for return, BaseClassCreationData for PUT body

// DB Representation and Mapper (can be shared if moved to a common util)
interface DbBaseClass {
  id: string;
  organisation_id: string;
  name: string;
  description?: string | null;
  settings?: { 
    subject?: string;
    gradeLevel?: string;
    lengthInWeeks?: number;
    // Ensure generatedOutline can be stored here if it comes through otherSettings
    generatedOutline?: any; // Or a more specific type if available
  } | null;
  created_at: string;
  updated_at: string;
}

function mapDbToUi(dbClass: DbBaseClass): BaseClass {
  return {
    id: dbClass.id,
    organisation_id: dbClass.organisation_id,
    name: dbClass.name,
    description: dbClass.description || undefined,
    subject: dbClass.settings?.subject,
    gradeLevel: dbClass.settings?.gradeLevel,
    lengthInWeeks: dbClass.settings?.lengthInWeeks ?? 0, 
    creationDate: dbClass.created_at,
    // settings: dbClass.settings, // if you want to pass the whole settings object
  };
}

// No longer need RouteParams interface if using context directly
// interface RouteParams {
//   params: {
//     baseClassId: string; 
//   }
// }

const AUTH_TOKEN_COOKIE_NAME_PATTERN = /^sb-.*-auth-token$/;

// Async wrapper to align with linter suggesting nextHeadersCookies() result is a Promise
const asyncMinimalWrappedCookies = async () => { // Made async
  const store = await cookies(); // Await here

  return {
    get: (name: string) => {
      const cookie = store.get(name);
      if (cookie && AUTH_TOKEN_COOKIE_NAME_PATTERN.test(name) && cookie.value.startsWith('base64-')) {
        console.log(`asyncMinimalWrappedCookies (get): Stripping 'base64-' prefix from ${name}`);
        return { ...cookie, value: cookie.value.substring(7) };
      }
      return cookie;
    },
    // Forwarding set, delete, and getAll with 'as any' to simplify type issues for this experiment
    // This is NOT robust for production but aims to test the prefix stripping theory
    set: (name: string, value: string, options: any) => (store as any).set(name, value, options),
    delete: (name: string, options: any) => (store as any).delete(name, options),
    getAll: (name?: string) => {
        const allOriginalCookies = (store as any).getAll(name); 
        if (Array.isArray(allOriginalCookies)) {
            return allOriginalCookies.map( (cookie: any) => { // Add type for cookie if known, else any for now
                if (cookie && typeof cookie.name === 'string' && AUTH_TOKEN_COOKIE_NAME_PATTERN.test(cookie.name) && typeof cookie.value === 'string' && cookie.value.startsWith('base64-')) {
                    console.log(`asyncMinimalWrappedCookies (getAll): Stripping 'base64-' prefix from ${cookie.name}`);
                    return { ...cookie, value: cookie.value.substring(7) };
                }
                return cookie;
            });
        }
        return allOriginalCookies; // In case getAll with name returns non-array or undefined
    }
    // Other methods (`has`, iterators, etc.) are omitted. If Supabase uses them, this wrapper is incomplete.
  };
};

// Helper to create Supabase client for Route Handlers using @supabase/ssr
// This helper itself needs to be async if cookies() needs to be awaited.
const createSupabaseRouteHandlerClient = async () => {
  const cookieStore = await cookies(); // Await the cookie store
  return createServerClient(
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
          cookieStore.delete({ name, ...options });
        },
      },
    }
  );
};

// GET a single base class by ID
export async function GET(request: Request, context: { params: { baseClassId: string } }) {
  const { baseClassId } = context.params;
  const supabase = await createSupabaseRouteHandlerClient(); // Await the helper
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('organisation_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profileData || !profileData.organisation_id) {
      return NextResponse.json({ error: 'User organisation not found.' }, { status: 403 });
    }
    const organisationId = profileData.organisation_id;

    const { data, error } = await supabase
      .from('base_classes')
      .select('*')
      .eq('id', baseClassId)
      .eq('organisation_id', organisationId) // RLS will also enforce this, but explicit check is good
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: 'Base Class not found' }, { status: 404 });
    }
    return NextResponse.json(mapDbToUi(data as DbBaseClass));
  } catch (error) {
    console.error(`API Error GET base-classes/${baseClassId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch base class' }, { status: 500 });
  }
}

// UPDATE a base class by ID
export async function PUT(request: Request, context: { params: { baseClassId: string } }) {
  const cookieHeader = request.headers.get('cookie');
  console.log('Raw cookie header in PUT /base-classes/[baseClassId] (using @supabase/ssr):', cookieHeader);

  const supabase = await createSupabaseRouteHandlerClient(); // Await the helper
  let body;
  try {
    body = await request.json();
  } catch (e) {
    console.error("Error parsing request body in PUT base-classes:", e);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { baseClassId } = context.params;
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, description, settings } = body as Partial<DbBaseClass>;

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('organisation_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profileData || !profileData.organisation_id) {
      return NextResponse.json({ error: 'User organisation not found for update.' }, { status: 403 });
    }
    const organisationId = profileData.organisation_id;

    const dbUpdateData: Partial<Omit<DbBaseClass, 'id' | 'organisation_id' | 'created_at'>> & { updated_at: string } = {
      updated_at: new Date().toISOString(),
    };
    if (name !== undefined) dbUpdateData.name = name;
    if (description !== undefined) dbUpdateData.description = description;
    if (settings !== undefined) dbUpdateData.settings = settings;
    
    if (Object.keys(dbUpdateData).length === 1 && dbUpdateData.updated_at && name === undefined && description === undefined && settings === undefined) {
        const { data: currentDataNoChange } = await supabase.from('base_classes').select('*').eq('id', baseClassId).single();
        if(currentDataNoChange) return NextResponse.json(mapDbToUi(currentDataNoChange as DbBaseClass));
        return NextResponse.json({ message: "No changes detected"});
    }

    const { data, error } = await supabase
      .from('base_classes')
      .update(dbUpdateData)
      .eq('id', baseClassId)
      .eq('organisation_id', organisationId)
      .select('*')
      .single();

    if (error) {
        console.error('Supabase update error:', error);
        throw error;
    }
    if (!data) {
      return NextResponse.json({ error: 'Base Class not found or update failed' }, { status: 404 });
    }
    return NextResponse.json(mapDbToUi(data as DbBaseClass));
  } catch (error: any) {
    console.error(`API Error PUT base-classes/${baseClassId}:`, error);
    let errorMessage = 'Failed to update base class';
    if (error.code) {
        errorMessage += `: ${error.message} (Code: ${error.code})`;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// PATCH a base class by ID (similar to PUT but more RESTful for partial updates)
export async function PATCH(request: Request, context: { params: { baseClassId: string } }) {
  const supabase = await createSupabaseRouteHandlerClient();
  const { baseClassId } = context.params;

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const updates = await request.json();

    // Get user's organisation
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('organisation_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profileData || !profileData.organisation_id) {
      return NextResponse.json({ error: 'User organisation not found for update.' }, { status: 403 });
    }

    // Prepare update data
    const allowedFields = ['name', 'description', 'subject', 'gradeLevel'];
    const dbUpdateData: any = {
      updated_at: new Date().toISOString(),
    };

    // Handle direct fields
    if (updates.name !== undefined) dbUpdateData.name = updates.name;
    if (updates.description !== undefined) dbUpdateData.description = updates.description;

    // Handle settings fields
    if (updates.subject !== undefined || updates.gradeLevel !== undefined) {
      // First get current settings
      const { data: currentData } = await supabase
        .from('base_classes')
        .select('settings')
        .eq('id', baseClassId)
        .single();

      const currentSettings = currentData?.settings || {};
      dbUpdateData.settings = {
        ...currentSettings,
        ...(updates.subject !== undefined && { subject: updates.subject }),
        ...(updates.gradeLevel !== undefined && { gradeLevel: updates.gradeLevel }),
      };
    }

    const { data, error } = await supabase
      .from('base_classes')
      .update(dbUpdateData)
      .eq('id', baseClassId)
      .eq('organisation_id', profileData.organisation_id)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating base class:', error);
      return NextResponse.json({ error: 'Failed to update base class', details: error.message }, { status: 500 });
    }

    return NextResponse.json(mapDbToUi(data as DbBaseClass));

  } catch (error: any) {
    console.error('PATCH Base Class API Error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred', details: error.message }, { status: 500 });
  }
}

// DELETE a base class by ID
export async function DELETE(request: Request, context: { params: { baseClassId: string } }) {
  const { baseClassId } = context.params;
  const supabase = await createSupabaseRouteHandlerClient(); // Await the helper
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('organisation_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profileData || !profileData.organisation_id) {
      return NextResponse.json({ error: 'User organisation not found for delete operation.' }, { status: 403 });
    }
    const organisationId = profileData.organisation_id;

    const { error } = await supabase
      .from('base_classes')
      .delete()
      .eq('id', baseClassId)
      .eq('organisation_id', organisationId);

    if (error) throw error;
    return NextResponse.json({ message: `Base Class ${baseClassId} deleted successfully` }, { status: 200 });
  } catch (error) {
    console.error(`API Error DELETE base-classes/${baseClassId}:`, error);
    return NextResponse.json({ error: 'Failed to delete base class' }, { status: 500 });
  }
} 