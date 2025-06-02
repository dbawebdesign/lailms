"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseAdmin = void 0;
/// <reference types="https://esm.sh/v135/@deno/deno@1.39.2/runtime/plugins/js_runtime.d.ts" />
const supabase_js_2_1 = require("https://esm.sh/@supabase/supabase-js@2");
// Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your environment
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl) {
    throw new Error('SUPABASE_URL is not set in the environment.');
}
if (!supabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set in the environment.');
}
exports.supabaseAdmin = (0, supabase_js_2_1.createClient)(supabaseUrl, supabaseServiceRoleKey);
