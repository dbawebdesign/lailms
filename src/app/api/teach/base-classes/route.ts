import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { BaseClassCreationData, BaseClass } from '@/types/teach'; // Our frontend type

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
    // any other settings
  } | null;
  created_at: string;
  updated_at: string;
}

// Helper to map DB representation to frontend type
function mapDbToUi(dbClass: DbBaseClass): BaseClass {
  return {
    id: dbClass.id,
    name: dbClass.name,
    description: dbClass.description || undefined,
    subject: dbClass.settings?.subject,
    gradeLevel: dbClass.settings?.gradeLevel,
    lengthInWeeks: dbClass.settings?.lengthInWeeks ?? 0, // Default to 0 if undefined
    creationDate: dbClass.created_at, // Assuming creationDate in UI is created_at from DB
    // organisationId: dbClass.organisation_id // if needed on frontend type
  };
}

export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("API Auth Error GET base-classes:", authError);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Get the user's organisation_id from the members (or profiles) table
    const { data: memberData, error: memberError } = await supabase
      .from('members') // or 'profiles' if that's the primary one linked to auth.users
      .select('organisation_id')
      .eq('id', user.id) // or 'user_id' if using profiles table
      .single();

    if (memberError || !memberData || !memberData.organisation_id) {
      console.error("API Error fetching member/organisation:", memberError);
      return NextResponse.json({ error: 'User organisation not found or an error occurred.' }, { status: 403 });
    }

    const organisationId = memberData.organisation_id;

    // 2. Fetch base_classes for that organisation_id
    const { data, error } = await supabase
      .from('base_classes')
      .select('*') // Select all columns defined in DbBaseClass
      .eq('organisation_id', organisationId)
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
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("API Auth Error POST base-classes:", authError);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json() as BaseClassCreationData;
    
    // 1. Get the user's organisation_id
    const { data: memberData, error: memberError } = await supabase
      .from('members') // or 'profiles'
      .select('organisation_id')
      .eq('id', user.id) // or 'user_id'
      .single();

    if (memberError || !memberData || !memberData.organisation_id) {
      console.error("API Error fetching member/organisation for POST:", memberError);
      return NextResponse.json({ error: 'User organisation not found for creation.' }, { status: 403 });
    }
    const organisationId = memberData.organisation_id;

    // 2. Prepare data for insertion, including structuring the settings JSONB
    const { name, description, subject, gradeLevel, lengthInWeeks, ...otherBodyData } = body;
    const dbInsertData = {
      organisation_id: organisationId,
      name,
      description: description || null,
      settings: {
        subject: subject || undefined,
        gradeLevel: gradeLevel || undefined,
        lengthInWeeks: lengthInWeeks || undefined, // Ensure it's a number or undefined
        // any other settings from otherBodyData if they go into JSONB
      },
      // created_at and updated_at will be set by Supabase default triggers
    };

    const { data, error } = await supabase
      .from('base_classes')
      .insert(dbInsertData)
      .select('*') // Select all columns of the newly created row
      .single(); // Expecting a single row back

    if (error) {
      console.error("API Error POST base-classes:", error);
      throw error;
    }

    if (!data) {
        console.error("API Error POST base-classes: No data returned after insert");
        return NextResponse.json({ error: 'Failed to create base class, no data returned.' }, { status: 500 });
    }

    return NextResponse.json(mapDbToUi(data as DbBaseClass), { status: 201 });

  } catch (error: any) {
    console.error("API Exception POST base-classes:", error);
    // Check for specific Supabase errors, e.g., unique constraint violation
    if (error.code === '23505') { // Unique violation
        return NextResponse.json({ error: 'A base class with this name might already exist or another unique constraint was violated.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create base class' }, { status: 500 });
  }
} 