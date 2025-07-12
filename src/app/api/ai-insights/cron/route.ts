import { createSupabaseServerClient } from '@/lib/supabase/server';
import { aiInsightsService } from '@/lib/services/ai-insights';
import { NextRequest, NextResponse } from 'next/server';
import { PROFILE_ROLE_FIELDS } from '@/lib/utils/roleUtils';

export async function POST(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🕐 Starting scheduled AI insights generation...');
    
    const supabase = createSupabaseServerClient();
    
    // Get all users who need fresh insights (no insights or expired)
    const { data: usersNeedingInsights, error } = await supabase
      .from('profiles')
      .select(`${PROFILE_ROLE_FIELDS}, user_id, first_name, last_name`)
      .not('user_id', 'is', null);

    if (error) {
      throw error;
    }

    if (!usersNeedingInsights || usersNeedingInsights.length === 0) {
      console.log('✅ No users need insights generation');
      return NextResponse.json({ 
        success: true, 
        processed: 0, 
        errors: 0,
        total: 0 
      });
    }

    let processed = 0;
    let errors = 0;

    for (const user of usersNeedingInsights) {
      try {
        // Check if user has valid insights
        const { data: existingInsights } = await supabase
          .from('ai_insights')
          .select('*')
          .eq('user_id', (user as any).user_id)
          .eq('is_dismissed', false)
          .gte('expires_at', new Date().toISOString())
          .single();

        // Skip if user already has valid insights
        if (existingInsights) {
          continue;
        }

        // Generate new insights
        console.log(`📊 Generating insights for ${(user as any).first_name} ${(user as any).last_name}`);
        await aiInsightsService.refreshInsights(supabase, (user as any).user_id);
        processed++;

        // Rate limiting - wait 1 second between requests
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (userError) {
        console.error(`❌ Error processing user ${(user as any).user_id}:`, userError);
        errors++;
      }
    }

    console.log(`✅ Cron job completed: ${processed} insights generated, ${errors} errors`);

    return NextResponse.json({ 
      success: true, 
      processed, 
      errors,
      total: usersNeedingInsights?.length || 0 
    });

  } catch (error: any) {
    console.error('❌ Cron job failed:', error);
    return NextResponse.json(
      { error: 'Cron job failed', details: error.message },
      { status: 500 }
    );
  }
}

// GET endpoint for manual testing
export async function GET() {
  return NextResponse.json({ 
    message: 'AI Insights Cron Job Endpoint',
    usage: 'POST with Bearer token to run scheduled generation'
  });
} 