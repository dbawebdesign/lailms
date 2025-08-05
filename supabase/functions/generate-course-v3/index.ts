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

    console.log(`🚀 Starting V3 course generation for job: ${jobId}`);

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update job status to processing
    const { error: updateError } = await supabase
      .from('course_generation_jobs')
      .update({ 
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

    if (updateError) {
      throw new Error(`Failed to update job status: ${updateError.message}`);
    }

    // Import the V3 orchestrator logic from the main app
    // For now, we'll call back to the main app's internal endpoint
    const baseUrl = Deno.env.get('NEXT_PUBLIC_SITE_URL') || 'https://www.learnologyai.com';
    const internalEndpoint = `${baseUrl}/api/internal/course-generation-v3`;

    console.log(`📡 Calling internal V3 orchestrator at: ${internalEndpoint}`);

    const orchestratorResponse = await fetch(internalEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'x-service-role': 'true', // Custom header to identify service calls
        'x-job-id': jobId
      },
      body: JSON.stringify({
        jobId,
        outline,
        request
      })
    });

    if (!orchestratorResponse.ok) {
      const errorText = await orchestratorResponse.text();
      console.error('Orchestrator failed:', errorText);
      throw new Error(`Orchestrator failed: ${errorText}`);
    }

    const result = await orchestratorResponse.json();
    console.log(`✅ V3 generation completed for job: ${jobId}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Course generation completed successfully',
        jobId,
        result
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Edge function error:', error);
    
    // Update job status to failed if we have jobId and supabase
    if (jobId && supabase) {
      try {
        await supabase
          .from('course_generation_jobs')
          .update({ 
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
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
        error: error instanceof Error ? error.message : 'Unknown error',
        jobId 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});