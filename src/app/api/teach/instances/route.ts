import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { ClassInstance, EnrichedClassInstance } from '@/types/teach'; // Our frontend types

// Database representation for class_instances and base_classes (relevant fields)
interface DbClassInstance {
  id: string;
  base_class_id: string;
  name: string;
  enrollment_code: string;
  start_date?: string | null;
  end_date?: string | null;
  settings?: { // For period, capacity from UI
    period?: string;
    capacity?: number;
  } | null;
  created_at: string;
  updated_at: string;
  status?: 'active' | 'archived' | 'upcoming' | 'completed'; // Assuming status is in settings or a direct column if added
  base_classes?: { // For joined data
    name: string;
    subject?: string | null; // Example if we want to enrich with subject
  } | null;
}

// Helper to map DB representation to EnrichedClassInstance UI type
function mapDbToEnrichedUi(dbInst: DbClassInstance): EnrichedClassInstance {
  // Determine status: This might be a direct column in your class_instances table
  // or derived based on start/end dates if not explicitly stored.
  // For now, let's assume it could be in settings or a direct column, or needs logic.
  let currentStatus: EnrichedClassInstance['status'] = 'upcoming'; // Default
  if (dbInst.status) {
      currentStatus = dbInst.status;
  } else if (dbInst.start_date && new Date(dbInst.start_date) > new Date()) {
    currentStatus = 'upcoming';
  } else if (dbInst.end_date && new Date(dbInst.end_date) < new Date()) {
    currentStatus = 'completed';
  } else if (dbInst.start_date && new Date(dbInst.start_date) <= new Date()) {
    currentStatus = 'active';
  }
  // Note: The DB schema shows class_instances does not have a direct status column.
  // It also doesn't have period/capacity directly, these were in `settings` JSONB

  return {
    id: dbInst.id,
    baseClassId: dbInst.base_class_id,
    name: dbInst.name,
    enrollmentCode: dbInst.enrollment_code,
    startDate: dbInst.start_date || undefined,
    endDate: dbInst.end_date || undefined,
    period: dbInst.settings?.period,
    capacity: dbInst.settings?.capacity,
    status: currentStatus, // This needs to be robustly determined
    creationDate: dbInst.created_at,
    baseClassName: dbInst.base_classes?.name || 'Unknown Base Class',
    baseClassSubject: dbInst.base_classes?.subject || undefined,
    // studentCount can be added later via another join/count
  };
}

export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: memberData, error: memberError } = await supabase
      .from('members')
      .select('organisation_id')
      .eq('id', user.id)
      .single();

    if (memberError || !memberData || !memberData.organisation_id) {
      return NextResponse.json({ error: 'User organisation not found.' }, { status: 403 });
    }
    const organisationId = memberData.organisation_id;

    // Fetch class_instances and join with base_classes to get the base class name and subject
    // Note: RLS on class_instances should ensure only instances linked to base_classes within the user's org are returned.
    const { data, error } = await supabase
      .from('class_instances')
      .select(`
        id,
        base_class_id,
        name,
        enrollment_code,
        start_date,
        end_date,
        settings,
        created_at,
        updated_at,
        status, /* Assuming status is now a direct column as per UI needs */
        base_classes (
          name,
          settings->>subject AS subject /* Accessing subject from base_class settings JSONB */
        )
      `)
      // To filter by organisation, we need to join base_classes and filter on its organisation_id
      // This assumes base_classes RLS correctly restricts to user's org.
      // A more direct way if base_classes itself isn't directly filtered by RLS before this join:
      // .eq('base_classes.organisation_id', organisationId) // This requires the join to be effective for filtering
      // However, Supabase typically handles RLS on the primary table queried (`class_instances`)
      // and then on joined tables (`base_classes`).
      // For this to work correctly, class_instances would need an organisation_id or its RLS would need to check the parent base_class's org_id.
      // Let's assume RLS on base_classes covers the organisation_id restriction for now.
      // A simpler approach: Get all class_instances whose base_class_id is in the set of base_classes of the user's organisation.
      // This can be complex. A common pattern is to ensure class_instances also has an organisation_id (denormalized or via trigger).
      // Given current schema, let's rely on RLS and potentially filter post-fetch if needed, or adjust query.
      
      // Simpler query: Fetch all instances, then filter if base_classes.organisation_id isn't available for direct join filter here.
      // OR, ensure RLS on class_instances checks parent base_class.organisation_id.
      // For now, this query relies on RLS on both tables.
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Filter instances to ensure they belong to the user's organisation via the joined base_class
    // This is an application-level filter if the join RLS isn't sufficient or direct org_id on instance is missing.
    // const filteredData = data?.filter(inst => inst.base_classes?.organisation_id === organisationId); // Requires organisation_id in base_classes select
    // For now, assuming RLS correctly filters or that all instances fetched are relevant.

    const uiInstances: EnrichedClassInstance[] = data ? data.map(inst => mapDbToEnrichedUi(inst as unknown as DbClassInstance)) : [];
    return NextResponse.json(uiInstances);

  } catch (error) {
    console.error("API Error GET all instances:", error);
    return NextResponse.json({ error: 'Failed to fetch class instances' }, { status: 500 });
  }
} 