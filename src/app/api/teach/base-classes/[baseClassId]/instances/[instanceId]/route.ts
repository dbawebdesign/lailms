import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { type ClassInstance, type ClassInstanceCreationData } from '@/types/teach'; // Assuming types
import { cookies } from 'next/headers';

// Helper to map database row to ClassInstance UI model
function mapDbInstanceToUi(dbInstance: any): ClassInstance {
  return {
    id: dbInstance.id,
    baseClassId: dbInstance.base_class_id,
    name: dbInstance.name,
    enrollmentCode: dbInstance.enrollment_code,
    startDate: dbInstance.start_date,
    endDate: dbInstance.end_date,
    status: dbInstance.status, // Assuming status is directly mapped or calculated
    createdAt: dbInstance.created_at,
    updatedAt: dbInstance.updated_at,
    creationDate: dbInstance.created_at, // Map to creationDate as well
    // Map settings from JSONB
    period: dbInstance.settings?.period,
    capacity: dbInstance.settings?.capacity,
    // Add other fields as necessary
  };
}

// Helper to map ClassInstanceCreationData UI model to database row for insert/update
function mapUiInstanceToDb(uiInstanceData: Partial<ClassInstanceCreationData | ClassInstance>, baseClassId: string, organisationId: string) {
  const dbRow: any = {
    base_class_id: baseClassId,
    organisation_id: organisationId,
  };
  if (uiInstanceData.name) dbRow.name = uiInstanceData.name;
  if (uiInstanceData.startDate) dbRow.start_date = uiInstanceData.startDate;
  if (uiInstanceData.endDate) dbRow.end_date = uiInstanceData.endDate;
  
  // Handle status carefully. It might be derived or set explicitly.
  // For simplicity, if provided, we set it. Otherwise, it might be set by a trigger or default.
  if ('status' in uiInstanceData && uiInstanceData.status) dbRow.status = uiInstanceData.status;


  // Consolidate settings into JSONB
  const settings: any = {};
  if (uiInstanceData.period) settings.period = uiInstanceData.period;
  if (uiInstanceData.capacity) settings.capacity = uiInstanceData.capacity;
  // Add other settings fields as necessary

  if (Object.keys(settings).length > 0) {
    dbRow.settings = settings;
  } else if (uiInstanceData.hasOwnProperty('period') || uiInstanceData.hasOwnProperty('capacity')) {
    // If keys are explicitly set to null/undefined, ensure settings is at least an empty object
    dbRow.settings = {};
  }


  return dbRow;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ baseClassId: string; instanceId: string }> }
) {
  const supabase = createSupabaseServerClient();
  const { baseClassId, instanceId } = await params;

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Error fetching user:', userError);
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organisation_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Error fetching profile organisation:', profileError);
      return NextResponse.json({ error: 'User not associated with an organisation' }, { status: 403 });
    }
    const organisationId = profile.organisation_id;

    // First, verify access to the base class
    const { data: baseClassOrg, error: baseClassOrgError } = await supabase
      .from('base_classes')
      .select('organisation_id')
      .eq('id', baseClassId)
      .single();

    if (baseClassOrgError || !baseClassOrg) {
      console.error('Error fetching base class for auth:', baseClassOrgError);
      return NextResponse.json({ error: 'Base class not found or access denied.' }, { status: 404 });
    }
    if (baseClassOrg.organisation_id !== organisationId) {
      return NextResponse.json({ error: 'Access to this base class is denied.' }, { status: 403 });
    }
    
    // Fetch the specific class instance
    const { data: instance, error: instanceError } = await supabase
      .from('class_instances')
      .select('*')
      .eq('id', instanceId)
      .eq('base_class_id', baseClassId) // Ensure it belongs to the specified base class
      .eq('organisation_id', organisationId) // Ensure it belongs to the user's organisation
      .single();

    if (instanceError) {
      console.error('Error fetching class instance:', instanceError);
      if (instanceError.code === 'PGRST116') { // Not found
        return NextResponse.json({ error: 'Class instance not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Failed to fetch class instance', details: instanceError.message }, { status: 500 });
    }

    if (!instance) {
      return NextResponse.json({ error: 'Class instance not found' }, { status: 404 });
    }

    return NextResponse.json(mapDbInstanceToUi(instance));

  } catch (error: any) {
    console.error('Unexpected error in GET /api/teach/base-classes/[baseClassId]/instances/[instanceId]:', error);
    return NextResponse.json({ error: 'An unexpected error occurred', details: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ baseClassId: string; instanceId: string }> }
) {
  const supabase = createSupabaseServerClient();
  const { baseClassId, instanceId } = await params;
  let updatedInstanceData;

  try {
    updatedInstanceData = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Error fetching user:', userError);
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organisation_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Error fetching profile organisation:', profileError);
      return NextResponse.json({ error: 'User not associated with an organisation' }, { status: 403 });
    }
    const organisationId = profile.organisation_id;

    // Verify access to the base class (and that it belongs to the org)
    const { data: baseClass, error: baseClassError } = await supabase
      .from('base_classes')
      .select('id, organisation_id')
      .eq('id', baseClassId)
      .eq('organisation_id', organisationId)
      .single();

    if (baseClassError || !baseClass) {
      console.error('Error verifying base class for update:', baseClassError);
      return NextResponse.json({ error: 'Base class not found or access denied.' }, { status: 404 });
    }

    // Check if the instance exists and belongs to the correct base class and organisation
    const { data: existingInstance, error: existingInstanceError } = await supabase
      .from('class_instances')
      .select('id')
      .eq('id', instanceId)
      .eq('base_class_id', baseClassId)
      .eq('organisation_id', organisationId)
      .single();

    if (existingInstanceError || !existingInstance) {
      console.error('Error finding instance to update:', existingInstanceError);
      return NextResponse.json({ error: 'Class instance not found or access denied for update.' }, { status: 404 });
    }

    const dbRowData = mapUiInstanceToDb(updatedInstanceData, baseClassId, organisationId);
    
    // Ensure we don't try to update base_class_id or organisation_id via this route directly
    // (they are fixed by the route params and auth)
    delete dbRowData.base_class_id;
    delete dbRowData.organisation_id;


    const { data: updatedDbInstance, error: updateError } = await supabase
      .from('class_instances')
      .update(dbRowData)
      .eq('id', instanceId)
      .eq('base_class_id', baseClassId) // Redundant but safe
      .eq('organisation_id', organisationId) // Redundant but safe
      .select()
      .single();

    if (updateError) {
      console.error('Error updating class instance:', updateError);
      return NextResponse.json({ error: 'Failed to update class instance', details: updateError.message }, { status: 500 });
    }

    if (!updatedDbInstance) {
      // Should not happen if select().single() is used after a successful update
      return NextResponse.json({ error: 'Failed to retrieve updated class instance data' }, { status: 500 });
    }
    
    return NextResponse.json(mapDbInstanceToUi(updatedDbInstance));

  } catch (error: any) {
    console.error('Unexpected error in PUT /api/teach/base-classes/[baseClassId]/instances/[instanceId]:', error);
    return NextResponse.json({ error: 'An unexpected error occurred', details: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ baseClassId: string; instanceId: string }> }
) {
  const supabase = createSupabaseServerClient();
  const { baseClassId, instanceId } = await params;

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Error fetching user:', userError);
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organisation_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Error fetching profile organisation:', profileError);
      return NextResponse.json({ error: 'User not associated with an organisation' }, { status: 403 });
    }
    const organisationId = profile.organisation_id;

    // Verify access to the base class
    const { data: baseClass, error: baseClassError } = await supabase
      .from('base_classes')
      .select('id, organisation_id')
      .eq('id', baseClassId)
      .eq('organisation_id', organisationId)
      .single();

    if (baseClassError || !baseClass) {
      console.error('Error verifying base class for delete op:', baseClassError);
      return NextResponse.json({ error: 'Base class not found or access denied.' }, { status: 404 });
    }

    // Delete the instance, ensuring it belongs to the correct base class and org
    const { error: deleteError, count } = await supabase
      .from('class_instances')
      .delete()
      .eq('id', instanceId)
      .eq('base_class_id', baseClassId)
      .eq('organisation_id', organisationId);

    if (deleteError) {
      console.error('Error deleting class instance:', deleteError);
      return NextResponse.json({ error: 'Failed to delete class instance', details: deleteError.message }, { status: 500 });
    }

    if (count === 0) {
        return NextResponse.json({ error: 'Class instance not found or not deleted' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Class instance deleted successfully' }, { status: 200 }); // Or 204 No Content

  } catch (error: any) {
    console.error('Unexpected error in DELETE /api/teach/base-classes/[baseClassId]/instances/[instanceId]:', error);
    return NextResponse.json({ error: 'An unexpected error occurred', details: error.message }, { status: 500 });
  }
} 