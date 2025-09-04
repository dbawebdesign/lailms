import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role key for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Starting daily class instance status update...')

    // Call the existing database function to update all class instance statuses
    const { error: updateError } = await supabase.rpc('update_class_instance_status')

    if (updateError) {
      console.error('Error updating class instance statuses:', updateError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to update class instance statuses',
          details: updateError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get summary of current statuses for logging
    const { data: statusSummary, error: summaryError } = await supabase
      .from('class_instances')
      .select('status')

    let summary = { total: 0, active: 0, upcoming: 0, completed: 0 }
    if (!summaryError && statusSummary) {
      summary.total = statusSummary.length
      summary.active = statusSummary.filter(i => i.status === 'active').length
      summary.upcoming = statusSummary.filter(i => i.status === 'upcoming').length
      summary.completed = statusSummary.filter(i => i.status === 'completed').length
    }

    const result = {
      success: true,
      message: 'Class instance statuses updated successfully',
      timestamp: new Date().toISOString(),
      summary
    }

    console.log('Daily class instance status update completed:', result)

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Unexpected error in daily class status update:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Unexpected error occurred',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
