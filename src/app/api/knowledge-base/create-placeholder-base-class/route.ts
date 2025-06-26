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
    const { organisationId, userId, skipAnalysis = false } = body;

    // Validate required fields
    if (!organisationId || !userId) {
      return NextResponse.json(
        { error: 'Organisation ID and user ID are required' }, 
        { status: 400 }
      );
    }

    // Verify user has access to the organization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organisation_id')
      .eq('user_id', userId)
      .single<Tables<'profiles'>>();

    if (profileError || profile?.organisation_id !== organisationId) {
      return NextResponse.json(
        { error: 'Invalid organization access' }, 
        { status: 403 }
      );
    }

    // Generate a timestamp for unique naming
    const timestamp = new Date().toISOString().split('T')[0];
    
    // Create placeholder base class
    const placeholderName = skipAnalysis 
      ? `New Course - ${timestamp}`
      : `Knowledge Base Course - ${timestamp}`;
    
    const placeholderDescription = skipAnalysis
      ? 'Course created for general knowledge generation'
      : 'Course automatically generated from knowledge base content. Details will be updated after content analysis.';

    const { data: baseClass, error: baseClassError } = await supabase
      .from('base_classes')
      .insert({
        name: placeholderName,
        description: placeholderDescription,
        organisation_id: organisationId,
        user_id: userId,
        settings: {
          knowledge_base_enabled: true,
          course_generation_enabled: true,
          created_via: 'knowledge_base_wizard',
          is_placeholder: !skipAnalysis,
          generation_mode: skipAnalysis ? 'general_knowledge' : 'knowledge_base_first'
        }
      })
      .select()
      .single<Tables<'base_classes'>>();

    if (baseClassError) {
      console.error('Placeholder base class creation error:', baseClassError);
      return NextResponse.json(
        { error: 'Failed to create course structure' }, 
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
        created_at: baseClass.created_at,
        isPlaceholder: !skipAnalysis
      },
      message: skipAnalysis 
        ? 'Course structure created for general knowledge generation'
        : 'Placeholder course structure created successfully. Ready for content upload and analysis.' 
    });

  } catch (error) {
    console.error('Create placeholder base class error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
} 