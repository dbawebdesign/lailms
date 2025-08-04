import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
    const { jobId } = await req.json();

    if (!jobId) {
      return new Response(
        JSON.stringify({ error: 'Missing jobId' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`🔄 Restarting generation for job: ${jobId}`);

    // Make a request to the main application's resume endpoint
    const baseUrl = Deno.env.get('NEXT_PUBLIC_SITE_URL') || 'https://www.learnologyai.com';
    const resumeUrl = `${baseUrl}/api/knowledge-base/jobs/${jobId}/resume`;
    
    // Use service role key for authentication
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    const resumeResponse = await fetch(resumeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'x-service-role': 'true' // Custom header to bypass user auth
      }
    });

    if (!resumeResponse.ok) {
      const errorText = await resumeResponse.text();
      console.error('Failed to resume job:', errorText);
      return new Response(
        JSON.stringify({ error: `Failed to resume job: ${errorText}` }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const result = await resumeResponse.json();
    console.log(`✅ Job ${jobId} restart result:`, result);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Job ${jobId} restart initiated via edge function`,
        result
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error restarting generation:', error);
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