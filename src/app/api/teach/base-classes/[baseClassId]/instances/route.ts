import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Tables } from 'packages/types/db';
import { ClassInstanceCreationData, ClassInstance } from '../../../../../../types/teach';

// DB Representation (subset for what we insert/select)
interface DbClassInstance {
  id: string;
  base_class_id: string;
  name: string;
  enrollment_code: string;
  start_date?: string | null;
  end_date?: string | null;
  settings?: { 
    period?: string;
    capacity?: number;
  } | null;
  status?: 'active' | 'archived' | 'upcoming' | 'completed'; // Assuming status is managed
  created_at: string;
  updated_at: string;
}

// Helper to map DB to UI (can be shared)
function mapDbToUiInstance(dbInst: DbClassInstance): ClassInstance {
  let currentStatus: ClassInstance['status'] = 'upcoming'; // Default if not set
  if (dbInst.status) {
    currentStatus = dbInst.status;
  } else if (dbInst.start_date && new Date(dbInst.start_date) > new Date()) {
    currentStatus = 'upcoming';
  } else if (dbInst.end_date && new Date(dbInst.end_date) < new Date()) {
    currentStatus = 'completed';
  } else if (dbInst.start_date && new Date(dbInst.start_date) <= new Date()) {
    currentStatus = 'active';
  }

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
  };
}

interface RouteParams {
  params: Promise<{
    baseClassId: string; // Renaming for clarity from Next.js route param name
  }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const { baseClassId: base_class_id_from_param } = await params; // Await params as required by Next.js 15
  const supabase = createSupabaseServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json() as Omit<ClassInstanceCreationData, 'base_class_id'>;
    const { name, start_date, end_date, settings, ...otherSettings } = body;

    // Retrieve organisation information from the profiles table
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('organisation_id')
      .eq('user_id', user.id)
      .single<Tables<'profiles'>>();

    if (profileError || !profileData || !profileData.organisation_id) {
      return NextResponse.json({ error: 'User organisation not found.' }, { status: 403 });
    }
    const organisationId = profileData.organisation_id;

    const { data: parentBaseClass, error: baseClassError } = await supabase
      .from('base_classes')
      .select('id')
      .eq('id', base_class_id_from_param)
      .eq('organisation_id', organisationId)
      .single<Tables<'base_classes'>>();

    if (baseClassError || !parentBaseClass) {
      return NextResponse.json({ error: 'Parent Base Class not found or not accessible.' }, { status: 404 });
    }
    
    let calculatedStatus: ClassInstance['status'] = 'upcoming';
    if (start_date && new Date(start_date) > new Date()) {
        calculatedStatus = 'upcoming';
    } else if (start_date && new Date(start_date) <= new Date()) {
        calculatedStatus = 'active';
    }
    // end_date could also influence status to 'completed' if in the past, but POST usually implies new/future

    const dbInsertData = {
      base_class_id: base_class_id_from_param,
      name,
      start_date: start_date ? new Date(start_date).toISOString().split('T')[0] : null, // Format as YYYY-MM-DD for DATE type
      end_date: end_date ? new Date(end_date).toISOString().split('T')[0] : null,
      settings: settings || null,
      status: calculatedStatus, // Explicitly set status
      // enrollment_code has a DB default
    };

    const { data, error: insertError } = await supabase
      .from('class_instances')
      .insert(dbInsertData)
      .select('*')
      .single<Tables<'class_instances'>>();

    if (insertError) throw insertError;
    if (!data) {
        return NextResponse.json({ error: 'Failed to create class instance, no data returned.' }, { status: 500 });
    }

    return NextResponse.json(mapDbToUiInstance(data as DbClassInstance), { status: 201 });

  } catch (error: any) {
    console.error(`API Error POST class instance for base_class ${base_class_id_from_param}:`, error);
    if (error.code === '23505') { // Unique violation (e.g. enrollment_code if somehow not unique despite default)
        return NextResponse.json({ error: 'Class instance creation resulted in a conflict (e.g., duplicate enrollment code).' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create class instance' }, { status: 500 });
  }
} 