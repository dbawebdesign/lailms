import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface CourseInfo {
  name: string;
  description: string;
  subject: string;
  targetAudience: string;
  learningObjectives: string[];
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { baseClassId, courseInfo }: { baseClassId: string; courseInfo: CourseInfo } = body;

    // Validate required fields
    if (!baseClassId || !courseInfo) {
      return NextResponse.json(
        { error: 'Base class ID and course info are required' }, 
        { status: 400 }
      );
    }

    // Validate course info structure
    const requiredFields = ['name', 'description', 'subject', 'targetAudience', 'learningObjectives'];
    for (const field of requiredFields) {
      if (!courseInfo[field as keyof CourseInfo]) {
        return NextResponse.json(
          { error: `Missing required course info field: ${field}` }, 
          { status: 400 }
        );
      }
    }

    if (!Array.isArray(courseInfo.learningObjectives) || courseInfo.learningObjectives.length === 0) {
      return NextResponse.json(
        { error: 'Learning objectives must be a non-empty array' }, 
        { status: 400 }
      );
    }

    // Verify the base class exists and user has access
    const { data: baseClass, error: baseClassError } = await supabase
      .from('base_classes')
      .select('id, user_id, name, settings')
      .eq('id', baseClassId)
      .eq('user_id', user.id)
      .single();

    if (baseClassError || !baseClass) {
      return NextResponse.json(
        { error: 'Base class not found or access denied' }, 
        { status: 404 }
      );
    }

    // Update the base class with the approved course information
    const updatedSettings = {
      ...baseClass.settings,
      knowledge_base_enabled: true,
      course_generation_enabled: true,
      created_via: 'knowledge_base_wizard',
      is_placeholder: false,
      ai_generated: true,
      generation_mode: 'knowledge_base_first',
      course_metadata: {
        subject: courseInfo.subject,
        target_audience: courseInfo.targetAudience,
        learning_objectives: courseInfo.learningObjectives,
        updated_at: new Date().toISOString()
      }
    };

    const { data: updatedBaseClass, error: updateError } = await supabase
      .from('base_classes')
      .update({
        name: courseInfo.name.trim(),
        description: courseInfo.description.trim(),
        settings: updatedSettings
      })
      .eq('id', baseClassId)
      .select()
      .single();

    if (updateError) {
      console.error('Base class update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update course information' }, 
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      baseClass: {
        id: updatedBaseClass.id,
        name: updatedBaseClass.name,
        description: updatedBaseClass.description,
        settings: updatedBaseClass.settings,
        updated_at: updatedBaseClass.updated_at
      },
      message: 'Course information updated successfully'
    });

  } catch (error) {
    console.error('Update base class info error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
} 