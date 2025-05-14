import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { BaseClassCreationData, BaseClass, GeneratedOutline } from '@/types/teach'; // Added GeneratedOutline
import { createClient } from '@supabase/supabase-js';

// Database representation (subset, focusing on what we insert/select)
interface DbBaseClass {
  id: string;
  organisation_id: string;
  name: string;
  description?: string | null;
  settings?: { // Matches our UI expectations for subject, gradeLevel, lengthInWeeks
    subject?: string;
    gradeLevel?: string;
    lengthInWeeks?: number;
    generatedOutline?: GeneratedOutline; // Added this field
    // any other settings
  } | null;
  created_at: string;
  updated_at: string;
}

// Helper to map DB representation to frontend type
function mapDbToUi(dbClass: DbBaseClass): BaseClass {
  return {
    id: dbClass.id,
    organisation_id: dbClass.organisation_id,
    name: dbClass.name,
    description: dbClass.description || undefined,
    subject: dbClass.settings?.subject,
    gradeLevel: dbClass.settings?.gradeLevel,
    lengthInWeeks: dbClass.settings?.lengthInWeeks ?? 0, // Default to 0 if undefined
    creationDate: dbClass.created_at, // Assuming creationDate in UI is created_at from DB
    settings: dbClass.settings || {}, // Pass through settings
  };
}

export async function GET(request: Request) {
  // Use createSupabaseServerClient which properly handles cookie management
  const supabase = createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("API Auth Error GET base-classes:", authError);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Get the user's organisation_id AND role from the profiles table
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('organisation_id, role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profileData || !profileData.organisation_id) {
      console.error("API Error fetching profile/organisation:", profileError);
      return NextResponse.json({ error: 'User organisation not found or an error occurred.' }, { status: 403 });
    }

    const organisationId = profileData.organisation_id;
    const userRole = profileData.role;

    // Check if user is authorized to view base classes (should be a teacher or admin)
    // For this specific request, we are fetching base classes created BY THIS USER,
    // so role check for viewing general org base classes might be less critical here,
    // but still good for ensuring only appropriate roles can access this endpoint.
    if (!userRole || (userRole !== 'teacher' && userRole !== 'admin' && userRole !== 'super_admin')) {
      console.error("API Error: User is not authorized to view base classes. Role:", userRole);
      return NextResponse.json({ error: 'You do not have permission to view base classes.' }, { status: 403 });
    }

    // 2. Fetch base_classes for that organisation_id AND created by the current user
    const { data, error } = await supabase
      .from('base_classes')
      .select('*') // Select all columns defined in DbBaseClass
      .eq('organisation_id', organisationId) // Ensure it's within their org
      .eq('user_id', user.id) // And created by this specific user
      .order('created_at', { ascending: false });

    if (error) {
      console.error("API Error GET base-classes:", error);
      throw error; // Let global error handler catch it or return specific response
    }
    
    const uiClasses: BaseClass[] = data ? data.map(mapDbToUi) : [];
    return NextResponse.json(uiClasses);

  } catch (error) {
    console.error("API Exception GET base-classes:", error);
    return NextResponse.json({ error: 'Failed to fetch base classes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Initialize Supabase client first, which already handles cookies internally
    const supabase = createSupabaseServerClient();
    
    // Forward the caller's Cookie header when we make internal fetch requests. Using the
    // header from the incoming request avoids the need to call the `cookies()` helper
    // (which Next.js now treats as an async dynamic API).
    const cookieHeader = request.headers.get('cookie') || '';
    
    // 1. Verify auth and user profile in one go
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("API Auth Error POST base-classes:", authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get the user's profile
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, organisation_id, role')
      .eq('user_id', user.id)
      .single();

    if (profileError) {
      console.error("API Error fetching profile:", profileError);
      return NextResponse.json({ 
        error: 'Failed to fetch user profile', 
        details: profileError.message 
      }, { status: 500 });
    }

    if (!profileData || !profileData.organisation_id) {
      console.error("API Error: User has no organisation_id in profile");
      return NextResponse.json({ error: 'User organisation not found for creation.' }, { status: 403 });
    }

    const organisationId = profileData.organisation_id;
    const userRole = profileData.role;

    // Check if user is authorized to create base classes (must be a teacher or admin)
    if (!userRole || (userRole !== 'teacher' && userRole !== 'admin' && userRole !== 'super_admin')) {
      console.error("API Error: User is not authorized to create base classes. Role:", userRole);
      return NextResponse.json({ error: 'You do not have permission to create base classes.' }, { status: 403 });
    }

    // 3. Parse request body
    const body = await request.json() as BaseClassCreationData;
    
    // 4. Use admin role to bypass RLS for trustworthy operations
    // We've already validated the user has permission above
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    
    // 5. Prepare data for insertion
    const { name, description, subject, gradeLevel, lengthInWeeks, settings, ...otherBodyData } = body;
    const dbInsertData = {
      organisation_id: organisationId,
      user_id: user.id,
      name,
      description: description || null,
      settings: {
        subject: subject || undefined,
        gradeLevel: gradeLevel || undefined,
        lengthInWeeks: lengthInWeeks || undefined,
        ...(settings || {}), // Merge any additional settings
      },
    };

    console.log("Attempting to insert base class with data:", {
      ...dbInsertData,
      userRole,
      userId: user.id,
    });

    // Use admin client to bypass RLS
    const { data, error } = await adminClient
      .from('base_classes')
      .insert(dbInsertData)
      .select('id, settings, organisation_id, name, description, created_at, updated_at') // Ensure all fields for DbBaseClass and what generate-lessons might need from settings
      .single();

    if (error) {
      console.error("API Error POST base-classes:", error);
      
      if (error.code === '42501') {
        return NextResponse.json({ 
          error: 'Permission denied: You do not have the required role or organization membership to create base classes.',
          details: error.message
        }, { status: 403 });
      }
      
      throw error;
    }

    if (!data) {
      console.error("API Error POST base-classes: No data returned after insert");
      return NextResponse.json({ error: 'Failed to create base class, no data returned.' }, { status: 500 });
    }

    const newDbBaseClass = data as DbBaseClass;
    const newBaseClassId = newDbBaseClass.id;

    // Trigger lesson and path generation
    if (newBaseClassId && newDbBaseClass.settings?.generatedOutline?.modules?.length) {
      try {
        // Construct the full URL for the internal fetch call
        const currentUrl = new URL(request.url);
        const generateLessonsUrl = `${currentUrl.origin}/api/teach/base-classes/${newBaseClassId}/generate-lessons`;
        
        console.log(`Attempting to trigger lesson generation for BaseClass ID: ${newBaseClassId} at ${generateLessonsUrl}`);

        const generationResponse = await fetch(generateLessonsUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          },
        });

        if (!generationResponse.ok) {
          const errorBody = await generationResponse.text(); // Use .text() for more flexible error logging
          console.error(`Failed to generate lessons for BaseClass ${newBaseClassId}. Status: ${generationResponse.status}. Body: ${errorBody}`);
          // Do not block the response for base class creation if lesson generation fails,
          // but log it. The user can manually trigger it later if needed.
        } else {
          const successBody = await generationResponse.json();
          console.log(`Successfully triggered lesson generation for BaseClass ${newBaseClassId}:`, successBody);
        }
      } catch (generationError: any) {
        console.error(`Error calling generate-lessons endpoint for BaseClass ${newBaseClassId}:`, generationError.message);
        // Log and continue
      }
    }

    return NextResponse.json(mapDbToUi(newDbBaseClass), { status: 201 });

  } catch (error: any) {
    console.error("API Exception POST base-classes:", error);
    // Check for specific Supabase errors, e.g., unique constraint violation
    if (error.code === '23505') { // Unique violation
        return NextResponse.json({ error: 'A base class with this name might already exist or another unique constraint was violated.' }, { status: 409 });
    }
    return NextResponse.json({ 
      error: 'Failed to create base class', 
      details: error.message || 'Unknown error'
    }, { status: 500 });
  }
} 