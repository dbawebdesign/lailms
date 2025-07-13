import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ClassInstance, EnrichedClassInstance } from '../../../../types/teach'; // Our frontend types
import { Tables } from 'packages/types/db';

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
    base_class_id: dbInst.base_class_id,
    name: dbInst.name,
    enrollment_code: dbInst.enrollment_code,
    start_date: dbInst.start_date || null,
    end_date: dbInst.end_date || null,
    settings: dbInst.settings || null,
    status: currentStatus,
    created_at: dbInst.created_at,
    updated_at: dbInst.updated_at,
    base_class: {
      id: dbInst.base_class_id,
      organisation_id: '', // We don't have this from the join
      name: dbInst.base_classes?.name || 'Unknown Base Class',
      description: null,
      settings: null,
      created_at: '',
      updated_at: '',
      user_id: null,
      assessment_config: null,
    },
  };
}

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: memberData, error: memberError } = await supabase
      .from('profiles')
      .select('organisation_id')
      .eq('user_id', user.id)
      .single<Tables<"profiles">>();

    if (memberError || !memberData || !memberData.organisation_id) {
      return NextResponse.json({ error: 'User organisation not found.' }, { status: 403 });
    }
    const organisationId = memberData.organisation_id;

    // Fetch class_instances and join with base_classes to get the base class name
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
        status,
        base_classes (
          name
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // For each instance, get the student count from rosters table
    const enrichedInstances: EnrichedClassInstance[] = [];
    
    for (const instance of data || []) {
      // Get student count for this instance
      const { count: studentCount, error: rosterError } = await supabase
        .from('rosters')
        .select('id', { count: 'exact' })
        .eq('class_instance_id', instance.id);

      if (rosterError) {
        console.error('Error fetching roster count for instance', instance.id, rosterError);
      }

      const enrichedInstance = mapDbToEnrichedUi(instance as unknown as DbClassInstance);
      enrichedInstance.student_count = studentCount || 0;
      enrichedInstance.instructor_count = 1; // Assuming 1 instructor per class for now

      enrichedInstances.push(enrichedInstance);
    }

    return NextResponse.json(enrichedInstances);

  } catch (error) {
    console.error("API Error GET all instances:", error);
    return NextResponse.json({ error: 'Failed to fetch class instances' }, { status: 500 });
  }
} 