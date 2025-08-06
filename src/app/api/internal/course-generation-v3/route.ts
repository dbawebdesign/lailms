import { NextRequest, NextResponse } from 'next/server';
import { CourseGenerationOrchestratorV3 } from '@/lib/services/course-generation-orchestrator-v3';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    // Verify this is an internal service call
    const serviceRole = request.headers.get('x-service-role');
    const authHeader = request.headers.get('authorization');
    
    if (serviceRole !== 'true' || !authHeader?.includes(process.env.SUPABASE_SERVICE_ROLE_KEY!)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobId, outline, request: generationRequest } = await request.json();

    if (!jobId || !outline || !generationRequest) {
      return NextResponse.json(
        { error: 'Missing required parameters' }, 
        { status: 400 }
      );
    }

    console.log(`🚀 Internal V3 orchestrator starting for job ${jobId}`);

    // Create service client for database operations
    const supabase = createSupabaseServiceClient();

    // Initialize and run V3 orchestrator
    const orchestrator = new CourseGenerationOrchestratorV3(supabase);
    
    // Start the orchestration asynchronously (don't await)
    // This prevents the 30-second Vercel timeout
    orchestrator.startOrchestration(jobId, outline, generationRequest).catch(error => {
      console.error(`❌ V3 orchestration failed for job ${jobId}:`, error);
    });

    console.log(`✅ Internal V3 orchestrator started for job ${jobId}`);

    return NextResponse.json({ 
      success: true, 
      message: 'V3 orchestration started (background processing)',
      jobId 
    });

  } catch (error) {
    console.error('Internal V3 orchestrator error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }, 
      { status: 500 }
    );
  }
}