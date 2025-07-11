import { createSupabaseServerClient } from '@/lib/supabase/server';
import { aiInsightsService } from '@/lib/services/ai-insights';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const insights = await aiInsightsService.getUserInsights(supabase, user.id);
    
    return NextResponse.json({ insights });
  } catch (error: any) {
    console.error('Error fetching AI insights:', error);
    return NextResponse.json(
      { error: 'Failed to fetch insights', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, insightId, userId } = body;

    // Handle admin/script requests for generating insights
    if (action === 'generate' && userId) {
      console.log(`🔄 Generating insights for user: ${userId}`);
      const supabase = createSupabaseServerClient();
      const insights = await aiInsightsService.refreshInsights(supabase, userId);
      return NextResponse.json({ insights, success: true });
    }

    // Handle authenticated user requests
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (action === 'refresh') {
      const insights = await aiInsightsService.refreshInsights(supabase, user.id);
      return NextResponse.json({ insights });
    } else if (action === 'dismiss' && insightId) {
      await aiInsightsService.dismissInsights(supabase, user.id, insightId);
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error processing AI insights action:', error);
    return NextResponse.json(
      { error: 'Failed to process action', details: error.message },
      { status: 500 }
    );
  }
} 