import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

interface RestartJobRequest {
  jobId: string;
  authKey?: string; // Optional auth key for security
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { jobId, authKey }: RestartJobRequest = await req.json();

    if (!jobId) {
      return new Response(
        JSON.stringify({ error: 'Missing jobId' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Optional basic auth check (you can set this in environment variables)
    const expectedAuthKey = Deno.env.get('RESTART_AUTH_KEY');
    if (expectedAuthKey && authKey !== expectedAuthKey) {
      return new Response(
        JSON.stringify({ error: 'Invalid auth key' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`🔄 Attempting to restart job: ${jobId}`);

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('course_generation_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if job is in processing state
    if (job.status !== 'processing') {
      return new Response(
        JSON.stringify({ 
          error: `Job is not in processing state. Current status: ${job.status}` 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Reset stale running tasks
    const { error: resetError } = await supabase
      .from('course_generation_tasks')
      .update({
        status: 'pending',
        started_at: null,
        updated_at: new Date().toISOString(),
        error_message: 'Reset by edge function restart'
      })
      .eq('job_id', jobId)
      .eq('status', 'running');

    if (resetError) {
      console.error('Failed to reset running tasks:', resetError);
    }

    // Update job timestamp
    await supabase
      .from('course_generation_jobs')
      .update({
        updated_at: new Date().toISOString(),
        error_message: 'Restarted by edge function'
      })
      .eq('id', jobId);

    // Make a request to restart the generation process
    // This will trigger the existing API endpoint that handles generation
    const restartUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/restart-generation-internal`;
    
    // Call internal restart function (this will be a separate edge function)
    const restartResponse = await fetch(restartUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ jobId, requestData: job.job_data })
    });

    if (!restartResponse.ok) {
      console.error('Failed to restart generation:', await restartResponse.text());
      return new Response(
        JSON.stringify({ error: 'Failed to restart generation process' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`✅ Job ${jobId} restart initiated successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Job ${jobId} restart initiated`,
        jobId
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error restarting job:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});