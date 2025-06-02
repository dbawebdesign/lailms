import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ClassInstanceCreationData, ClassInstance } from '@/types/teach';

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
    baseClassId: dbInst.base_class_id,
    name: dbInst.name,
    enrollmentCode: dbInst.enrollment_code,
    startDate: dbInst.start_date || undefined,
    endDate: dbInst.end_date || undefined,
    period: dbInst.settings?.period,
    capacity: dbInst.settings?.capacity,
    status: currentStatus,
    creationDate: dbInst.created_at,
    createdAt: dbInst.created_at,
    updatedAt: dbInst.updated_at,
  };
}

interface RouteParams {
  params: {
    baseClassId: string; // Renaming for clarity from Next.js route param name
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const { baseClassId: base_class_id_from_param } = await params; // Await params as required by Next.js 15
  const supabase = createSupabaseServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json() as Omit<ClassInstanceCreationData, 'baseClassId'>;
    const { name, startDate, endDate, period, capacity, ...otherSettings } = body;

    // Retrieve organisation information from the profiles table
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('organisation_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profileData || !profileData.organisation_id) {
      return NextResponse.json({ error: 'User organisation not found.' }, { status: 403 });
    }
    const organisationId = profileData.organisation_id;

    const { data: parentBaseClass, error: baseClassError } = await supabase
      .from('base_classes')
      .select('id')
      .eq('id', base_class_id_from_param)
      .eq('organisation_id', organisationId)
      .single();

    if (baseClassError || !parentBaseClass) {
      return NextResponse.json({ error: 'Parent Base Class not found or not accessible.' }, { status: 404 });
    }
    
    let calculatedStatus: ClassInstance['status'] = 'upcoming';
    if (startDate && new Date(startDate) > new Date()) {
        calculatedStatus = 'upcoming';
    } else if (startDate && new Date(startDate) <= new Date()) {
        calculatedStatus = 'active';
    }
    // end_date could also influence status to 'completed' if in the past, but POST usually implies new/future

    const dbInsertData = {
      base_class_id: base_class_id_from_param,
      name,
      start_date: startDate ? new Date(startDate).toISOString().split('T')[0] : null, // Format as YYYY-MM-DD for DATE type
      end_date: endDate ? new Date(endDate).toISOString().split('T')[0] : null,
      settings: {
        period: period || undefined,
        capacity: capacity || undefined,
        ...otherSettings
      },
      status: calculatedStatus, // Explicitly set status
      // enrollment_code has a DB default
    };

    const { data, error: insertError } = await supabase
      .from('class_instances')
      .insert(dbInsertData)
      .select('*')
      .single();

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