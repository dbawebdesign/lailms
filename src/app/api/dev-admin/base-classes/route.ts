import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

const DEV_ADMIN_PASSWORD = 'TerroirLAI';

function validateDevAdminPassword(request: NextRequest): boolean {
  const authHeader = request.headers.get('x-dev-admin-password');
  return authHeader === DEV_ADMIN_PASSWORD;
}

export async function POST(request: NextRequest) {
  // Check dev admin password
  if (!validateDevAdminPassword(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createSupabaseServiceClient();
    const body = await request.json();
    
    const { name, description, course_catalog = true } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Course name is required' }, 
        { status: 400 }
      );
    }

    // Create a special organization for course catalog items if it doesn't exist
    let catalogOrg;
    const { data: existingOrg } = await supabase
      .from('organisations')
      .select('id')
      .eq('name', 'Course Catalog')
      .single();

    if (existingOrg) {
      catalogOrg = existingOrg;
    } else {
      const { data: newOrg, error: orgError } = await supabase
        .from('organisations')
        .insert({
          name: 'Course Catalog',
          abbreviation: 'CATALOG',
          organisation_type: 'catalog'
        })
        .select()
        .single();

      if (orgError) {
        console.error('Error creating catalog organization:', orgError);
        return NextResponse.json(
          { error: 'Failed to create catalog organization' },
          { status: 500 }
        );
      }

      catalogOrg = newOrg;
    }

    // Create the base class
    const { data: baseClass, error: baseClassError } = await supabase
      .from('base_classes')
      .insert({
        name,
        description,
        organisation_id: catalogOrg.id,
        course_catalog,
        settings: {
          course_metadata: {
            created_by: 'dev-admin',
            catalog_entry: true
          }
        }
      })
      .select()
      .single();

    if (baseClassError) {
      console.error('Error creating base class:', baseClassError);
      return NextResponse.json(
        { error: 'Failed to create base class' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      baseClass
    });

  } catch (error) {
    console.error('Error in dev-admin base class creation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
