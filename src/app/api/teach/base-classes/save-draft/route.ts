import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { outline, title, description, isDraft = true } = body;

    console.log('📝 Saving course outline as draft:', { title, isDraft });

    const supabase = createSupabaseServerClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('❌ User authentication error:', userError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('organisation_id, role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profileData) {
      console.error('❌ User profile not found:', profileError);
      return NextResponse.json({ error: 'User profile not found' }, { status: 400 });
    }

    const profile = profileData as any;

    if (!profile.organisation_id) {
      console.error('❌ User organization not found');
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 });
    }

    // Check authorization
    if (!profile.role || (profile.role !== 'teacher' && profile.role !== 'admin' && profile.role !== 'super_admin')) {
      console.error('❌ User not authorized to save drafts. Role:', profile.role);
      return NextResponse.json({ error: 'You do not have permission to save course drafts.' }, { status: 403 });
    }

    // Use admin client
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Prepare draft data
    const dbInsertData = {
      organisation_id: profile.organisation_id,
      user_id: user.id,
      name: `[DRAFT] ${title || outline.baseClassName || 'Course Outline'}`,
      description: description || outline.description || 'Course outline saved as draft',
      settings: {
        subject: outline.subject || '',
        gradeLevel: outline.gradeLevel || '',
        lengthInWeeks: outline.lengthInWeeks || 12,
        generatedOutline: outline,
        isDraft: true
      }
    };

    console.log('Saving draft with data:', dbInsertData);

    // Save draft
    const { data: draftClass, error: draftError } = await adminClient
      .from('base_classes')
      .insert(dbInsertData)
      .select('id, name, description, settings')
      .single();

    if (draftError) {
      console.error('❌ Error saving draft:', draftError);
      return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 });
    }

    if (!draftClass) {
      console.error('❌ No data returned after draft save');
      return NextResponse.json({ error: 'Failed to save draft, no data returned.' }, { status: 500 });
    }

    console.log('✅ Draft saved successfully:', draftClass.id);

    return NextResponse.json({
      success: true,
      draftId: draftClass.id,
      draft: draftClass,
      message: 'Course outline saved as draft successfully'
    });

  } catch (error) {
    console.error('❌ Error in save-draft API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 