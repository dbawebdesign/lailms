/// <reference types="https://esm.sh/v135/@deno/deno@1.39.2/runtime/plugins/js_runtime.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your environment
const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL is not set in the environment.');
}
if (!supabaseServiceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set in the environment.');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey); 