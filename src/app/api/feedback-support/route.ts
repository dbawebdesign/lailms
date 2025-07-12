import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

import { PROFILE_ROLE_FIELDS } from '@/lib/utils/roleUtils';
// Validation schema for the API
const feedbackSupportSchema = z.object({
  category: z.enum(['feedback', 'support', 'bug_report']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  subject: z.string().min(5).max(100),
  message: z.string().min(10).max(2000),
  contactEmail: z.string().email().optional().or(z.literal('')),
  wantsFollowup: z.boolean().default(false),
  currentPage: z.string().optional(),
  browserInfo: z.object({
    userAgent: z.string(),
    language: z.string(),
    platform: z.string(),
    screenResolution: z.string(),
    windowSize: z.string(),
    timestamp: z.string(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile to get organization info
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, organisation_id, first_name, last_name')
      .eq('user_id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = feedbackSupportSchema.parse(body);

    // Prepare data for database insertion
    const insertData = {
      user_id: user.id,
      organisation_id: profile?.organisation_id || null,
      category: validatedData.category,
      priority: validatedData.priority,
      subject: validatedData.subject,
      message: validatedData.message,
      contact_email: validatedData.contactEmail || user.email || null,
      wants_followup: validatedData.wantsFollowup,
      current_page: validatedData.currentPage || null,
      user_agent: validatedData.browserInfo?.userAgent || null,
      browser_info: validatedData.browserInfo || null,
      status: 'open' as const,
    };

    // Insert feedback into database
    const { data: feedback, error: insertError } = await supabase
      .from('feedback_support')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting feedback:', insertError);
      return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
    }

    // Log successful submission for monitoring
    console.log(`Feedback submitted: ${feedback.id} - ${validatedData.category} - ${validatedData.priority} - User: ${user.id}`);

    return NextResponse.json({
      success: true,
      id: feedback.id,
      message: 'Feedback submitted successfully',
    });

  } catch (error) {
    console.error('Error in feedback-support API:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid data provided',
        details: error.errors,
      }, { status: 400 });
    }

    return NextResponse.json({
      error: 'Internal server error',
    }, { status: 500 });
  }
}

// GET endpoint for admins to retrieve feedback (optional)
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile to check if they're an admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(PROFILE_ROLE_FIELDS + ', user_id, organisation_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 });
    }

    // Only admins and super_admins can retrieve feedback
    if (!['admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');

    // Build query
    let query = supabase
      .from('feedback_support')
      .select(`
        *,
        profiles!feedback_support_user_id_fkey (
          first_name,
          last_name
        )
      `)
      .eq('organisation_id', profile.organisation_id!)
      .order('created_at', { ascending: false });

    // Add filters if provided
    if (category) query = query.eq('category', category as 'feedback' | 'support' | 'bug_report');
    if (status) query = query.eq('status', status as 'open' | 'in_progress' | 'resolved' | 'closed');
    if (priority) query = query.eq('priority', priority as 'low' | 'medium' | 'high' | 'critical');

    // Add pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: feedback, error: fetchError, count } = await query;

    if (fetchError) {
      console.error('Error fetching feedback:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: feedback,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit),
      },
    });

  } catch (error) {
    console.error('Error in feedback-support GET API:', error);
    return NextResponse.json({
      error: 'Internal server error',
    }, { status: 500 });
  }
} 