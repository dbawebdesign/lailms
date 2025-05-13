import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
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
  } | null;
  created_at: string;
  updated_at: string;
}

function mapDbToUi(dbClass: DbBaseClass): BaseClass {
  return {
    id: dbClass.id,
    name: dbClass.name,
    description: dbClass.description || undefined,
    subject: dbClass.settings?.subject,
    gradeLevel: dbClass.settings?.gradeLevel,
    lengthInWeeks: dbClass.settings?.lengthInWeeks ?? 0, 
    creationDate: dbClass.created_at,
  };
}

interface RouteParams {
  params: {
    baseClassId: string; 
  }
}

// GET a single base class by ID
export async function GET(request: Request, { params }: RouteParams) {
  const { baseClassId } = params;
  const supabase = createRouteHandlerClient({ cookies });
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
export async function PUT(request: Request, { params }: RouteParams) {
  const { baseClassId } = params;
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json() as Partial<BaseClassCreationData>;
    const { name, description, subject, gradeLevel, lengthInWeeks, ...otherSettings } = body;

    // Fetch user's organisation_id to ensure they can only update within their org
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('organisation_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profileData || !profileData.organisation_id) {
      return NextResponse.json({ error: 'User organisation not found for update.' }, { status: 403 });
    }
    const organisationId = profileData.organisation_id;

    // Fetch existing settings to merge, as PUT should ideally merge settings JSONB
    const { data: existingClass, error: fetchError } = await supabase
        .from('base_classes')
        .select('settings')
        .eq('id', baseClassId)
        .eq('organisation_id', organisationId)
        .single();

    if (fetchError || !existingClass) {
        console.error("API Error fetching existing class for PUT settings merge:", fetchError);
        return NextResponse.json({ error: 'Original base class not found for update or permission issue.' }, { status: 404 });
    }

    const newSettings = {
        ...(existingClass.settings as object || {}),
        ...(subject !== undefined && { subject }),
        ...(gradeLevel !== undefined && { gradeLevel }),
        ...(lengthInWeeks !== undefined && { lengthInWeeks }),
        ...otherSettings // if any other part of body should go into settings
    };

    const dbUpdateData: Partial<DbBaseClass> & { updated_at: string } = {
      updated_at: new Date().toISOString(), // Manually set updated_at if not using db trigger for it on all updates
    };
    if (name !== undefined) dbUpdateData.name = name;
    if (description !== undefined) dbUpdateData.description = description;
    // Only include settings if there are actual changes to be made to it
    if (Object.keys(newSettings).some(key => 
        (newSettings as any)[key] !== undefined && 
        (newSettings as any)[key] !== (existingClass.settings as any)?.[key]
    )) {
        dbUpdateData.settings = newSettings;
    }
    
    // Prevent accidental update of organisation_id or id
    delete (dbUpdateData as any).organisation_id;
    delete (dbUpdateData as any).id;

    if (Object.keys(dbUpdateData).length === 1 && dbUpdateData.updated_at) {
        // Only updated_at is set, no actual data change, return existing or 200 OK with current data
        const { data: currentDataNoChange } = await supabase.from('base_classes').select('*').eq('id', baseClassId).single();
        if(currentDataNoChange) return NextResponse.json(mapDbToUi(currentDataNoChange as DbBaseClass));
        return NextResponse.json({ message: "No changes detected"});
    }

    const { data, error } = await supabase
      .from('base_classes')
      .update(dbUpdateData)
      .eq('id', baseClassId)
      .eq('organisation_id', organisationId) // RLS also handles this
      .select('*')
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: 'Base Class not found or update failed' }, { status: 404 });
    }
    return NextResponse.json(mapDbToUi(data as DbBaseClass));
  } catch (error) {
    console.error(`API Error PUT base-classes/${baseClassId}:`, error);
    return NextResponse.json({ error: 'Failed to update base class' }, { status: 500 });
  }
}

// DELETE a base class by ID
export async function DELETE(request: Request, { params }: RouteParams) {
  const { baseClassId } = params;
  const supabase = createRouteHandlerClient({ cookies });
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

    // TODO: Consider implications of deleting a base class with active instances.
    // Should it be archived instead? Or cascade delete instances (current schema has ON DELETE CASCADE for instances)?
    const { error } = await supabase
      .from('base_classes')
      .delete()
      .eq('id', baseClassId)
      .eq('organisation_id', organisationId); // RLS handles this too

    if (error) throw error;
    return NextResponse.json({ message: `Base Class ${baseClassId} deleted successfully` }, { status: 200 }); // Or 204 No Content
  } catch (error) {
    console.error(`API Error DELETE base-classes/${baseClassId}:`, error);
    return NextResponse.json({ error: 'Failed to delete base class' }, { status: 500 });
  }
} 