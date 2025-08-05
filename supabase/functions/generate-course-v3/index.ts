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

    // Get the correct base URL for the internal API call
    // Check multiple environment variables to find the right URL
    let baseUrl = Deno.env.get('NEXT_PUBLIC_SITE_URL') || 
                  Deno.env.get('VERCEL_URL') || 
                  Deno.env.get('SITE_URL');
    
    // If we have a Vercel URL but no protocol, add https
    if (baseUrl && !baseUrl.startsWith('http')) {
      baseUrl = `https://${baseUrl}`;
    }
    
    // For local development, we need to use a different approach
    // The edge function runs in Supabase's cloud, so it can't reach localhost
    // We'll use the production URL or a tunnel URL for development
    if (!baseUrl) {
      // Default to production URL - this should work for most cases
      baseUrl = 'https://www.learnologyai.com';
      console.log(`⚠️ No base URL found in environment, using production: ${baseUrl}`);
    }
    
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
      console.error(`❌ Internal orchestrator failed: ${orchestratorResponse.status} - ${errorText}`);
      throw new Error(`Internal orchestrator failed: ${orchestratorResponse.status} - ${errorText}`);
    }

    const result = await orchestratorResponse.json();
    console.log(`✅ V3 orchestration completed for job ${jobId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        jobId,
        message: 'Course generation completed successfully',
        result 
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