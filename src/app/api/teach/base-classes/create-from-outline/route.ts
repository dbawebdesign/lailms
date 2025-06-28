import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

interface CourseOutlineModule {
  title: string;
  topics: string[];
  suggestedLessons?: { title: string; objective?: string }[];
  suggestedAssessments?: { type: string; description?: string }[];
}

interface GeneratedCourseOutline {
  baseClassName?: string;
  description?: string;
  subject?: string;
  gradeLevel?: string;
  lengthInWeeks?: number;
  modules: CourseOutlineModule[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { outline, title, description, subject, gradeLevel, lengthInWeeks } = body;

    console.log('📝 Creating base class from outline:', { title, subject, gradeLevel });

    const supabase = createSupabaseServerClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('❌ User authentication error:', userError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile using any type to avoid TS issues
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('organisation_id, role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profileData) {
      console.error('❌ User profile not found:', profileError);
      return NextResponse.json({ error: 'User profile not found' }, { status: 400 });
    }

    const profile = profileData as any; // Use any to bypass TS issues

    if (!profile.organisation_id) {
      console.error('❌ User organization not found');
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 });
    }

    // Check if user is authorized to create base classes
    if (!profile.role || (profile.role !== 'teacher' && profile.role !== 'admin' && profile.role !== 'super_admin')) {
      console.error('❌ User not authorized to create base classes. Role:', profile.role);
      return NextResponse.json({ error: 'You do not have permission to create base classes.' }, { status: 403 });
    }

    // Use admin client to bypass RLS like in the existing base-classes API
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Prepare data for insertion using the same pattern as existing API
    const dbInsertData = {
      organisation_id: profile.organisation_id,
      user_id: user.id,
      name: title || outline.baseClassName || 'New Course',
      description: description || outline.description || '',
      settings: {
        subject: subject || outline.subject || '',
        gradeLevel: gradeLevel || outline.gradeLevel || '',
        lengthInWeeks: lengthInWeeks || outline.lengthInWeeks || 12,
        generatedOutline: outline // Store the full outline for later use
      }
    };

    console.log('Attempting to insert base class with data:', dbInsertData);

    // Create base class using admin client
    const { data: baseClass, error: baseClassError } = await adminClient
      .from('base_classes')
      .insert(dbInsertData)
      .select('id, name, description, settings, organisation_id, created_at, updated_at')
      .single();

    if (baseClassError) {
      console.error('❌ Error creating base class:', baseClassError);
      return NextResponse.json({ error: 'Failed to create base class' }, { status: 500 });
    }

    if (!baseClass) {
      console.error('❌ No data returned after insert');
      return NextResponse.json({ error: 'Failed to create base class, no data returned.' }, { status: 500 });
    }

    console.log('✅ Base class created successfully:', baseClass.id);

    return NextResponse.json({
      success: true,
      baseClassId: baseClass.id,
      baseClass,
      message: 'Base class created successfully from course outline'
    });

  } catch (error) {
    console.error('❌ Error in create-from-outline API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 