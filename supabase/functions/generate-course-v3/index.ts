import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateRequest {
  jobId: string;
  outline: any;
  request: any;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let jobId: string | undefined;
  let supabase: any;

  try {
    const { jobId: requestJobId, outline, request } = await req.json() as GenerateRequest;
    jobId = requestJobId;

    if (!jobId || !outline || !request) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: jobId, outline, or request' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`🚀 Edge function starting V3 course generation for job ${jobId}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }
    
    supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update job status to processing
    console.log(`📊 Updating job ${jobId} status to processing...`);
    const { error: updateError } = await supabase
      .from('course_generation_jobs')
      .update({
        status: 'processing',
        progress_percentage: 90,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

    if (updateError) {
      throw new Error(`Failed to update job status: ${updateError.message}`);
    }

    // Start V3 orchestration asynchronously
    // We'll call the internal API but NOT wait for it to complete
    // This avoids the Edge Function 30-second timeout
    console.log(`🔥 ASYNC PROCESSING STARTED: Function invoked, returning immediately while processing continues in background...`);
    
    const baseUrl = 'https://www.learnologyai.com';
    const internalEndpoint = `${baseUrl}/api/internal/course-generation-v3`;
    
    console.log(`📡 Invoking internal V3 orchestrator at: ${internalEndpoint}`);
    
    // Fire the request but don't await it - let it run in background
    // This way the Edge Function returns immediately and the orchestration continues
    fetch(internalEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'x-service-role': 'true',
        'x-job-id': jobId
      },
      body: JSON.stringify({
        jobId,
        outline,
        request
      })
    }).then(response => {
      if (response.ok) {
        console.log(`✅ Background V3 orchestration started successfully for job ${jobId}`);
      } else {
        console.error(`❌ Background orchestration failed with status ${response.status} for job ${jobId}`);
      }
    }).catch(error => {
      console.error(`❌ Background orchestration error for job ${jobId}:`, error);
      // Try to update job status to failed
      supabase
        .from('course_generation_jobs')
        .update({
          status: 'failed',
          error_message: `Background orchestration failed: ${error.message}`,
          failed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId)
        .then(() => console.log(`Updated job ${jobId} status to failed`))
        .catch(err => console.error(`Failed to update job status:`, err));
    });

    console.log(`🚀 V3 Edge Function returning immediately - orchestration continues in background for job ${jobId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        jobId,
        message: 'V3 orchestration started in background - processing will continue asynchronously'
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Edge function error:', error);
    
    // Update job status to failed if we have the jobId
    if (jobId && supabase) {
      try {
        await supabase
          .from('course_generation_jobs')
          .update({
            status: 'failed',
            error_message: error.message,
            failed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', jobId);
      } catch (updateError) {
        console.error('Failed to update job status to failed:', updateError);
      }
    }

    return new Response(
      JSON.stringify({ 
        error: 'Course generation failed', 
        details: error.message,
        jobId 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});