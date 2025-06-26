import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Tables } from 'packages/types/db';

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, organisationId, userId } = body;

    // Validate required fields
    if (!name || !organisationId || !userId) {
      return NextResponse.json(
        { error: 'Name, organisation ID, and user ID are required' }, 
        { status: 400 }
      );
    }

    // Verify user has access to the organization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organisation_id')
      .eq('user_id', userId)
      .single<Tables<"profiles">>();

    if (profileError || profile?.organisation_id !== organisationId) {
      return NextResponse.json(
        { error: 'Invalid organization access' }, 
        { status: 403 }
      );
    }

    // Create the base class
    const { data: baseClass, error: baseClassError } = await supabase
      .from('base_classes')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        organisation_id: organisationId,
        user_id: userId,
        settings: {
          knowledge_base_enabled: true,
          course_generation_enabled: true,
          created_via: 'knowledge_base_wizard'
        }
      })
      .select()
      .single<Tables<"base_classes">>();

    if (baseClassError) {
      console.error('Base class creation error:', baseClassError);
      return NextResponse.json(
        { error: 'Failed to create base class' }, 
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      baseClassId: baseClass.id,
      baseClass: {
        id: baseClass.id,
        name: baseClass.name,
        description: baseClass.description,
        created_at: baseClass.created_at
      },
      message: 'Base class created successfully' 
    });

  } catch (error) {
    console.error('Create base class error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
} 