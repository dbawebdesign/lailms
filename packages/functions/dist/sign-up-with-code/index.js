"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("jsr:@std/http");
const cors_ts_1 = require("../_shared/cors.ts");
const supabaseAdmin_ts_1 = require("../_shared/supabaseAdmin.ts");
const config_ts_1 = require("../_shared/config.ts");
// Function to generate a random alphanumeric string of a given length
function generateRandomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}
(0, http_1.serve)(async (req) => {
    var _a, _b, _c;
    // This is needed if you're planning to invoke your function from a browser.
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: cors_ts_1.corsHeaders });
    }
    try {
        const payload = (await req.json());
        const { invite_code, email, password, first_name, last_name, user_metadata, email_redirect_to } = payload;
        if (!invite_code) {
            return new Response(JSON.stringify({ error: 'Invite code is required' }), {
                headers: Object.assign(Object.assign({}, cors_ts_1.corsHeaders), { 'Content-Type': 'application/json' }),
                status: 400,
            });
        }
        // 1. Verify the invite code
        const { data: inviteData, error: inviteError } = await supabaseAdmin_ts_1.supabaseAdmin
            .from('invite_codes')
            .select('*')
            .eq('code', invite_code)
            .single();
        if (inviteError || !inviteData) {
            console.error('Invite code verification error:', inviteError);
            return new Response(JSON.stringify({ error: 'Invalid or expired invite code' }), {
                headers: Object.assign(Object.assign({}, cors_ts_1.corsHeaders), { 'Content-Type': 'application/json' }),
                status: 400,
            });
        }
        // Check if invite code is already used
        if (inviteData.status === 'used') {
            return new Response(JSON.stringify({ error: 'Invite code has already been used' }), {
                headers: Object.assign(Object.assign({}, cors_ts_1.corsHeaders), { 'Content-Type': 'application/json' }),
                status: 400,
            });
        }
        // Check if invite code has expired
        if (new Date(inviteData.expires_at) < new Date()) {
            return new Response(JSON.stringify({ error: 'Invite code has expired' }), {
                headers: Object.assign(Object.assign({}, cors_ts_1.corsHeaders), { 'Content-Type': 'application/json' }),
                status: 400,
            });
        }
        // If email is provided in the payload, it must match the email in the invite code (if inviteData.email is not null)
        const targetEmail = inviteData.email || email; // Use inviteData.email if present, otherwise payload email
        if (!targetEmail) {
            return new Response(JSON.stringify({ error: 'Email is required either in invite or payload' }), {
                headers: Object.assign(Object.assign({}, cors_ts_1.corsHeaders), { 'Content-Type': 'application/json' }),
                status: 400,
            });
        }
        if (email && inviteData.email && email !== inviteData.email) {
            return new Response(JSON.stringify({
                error: 'Provided email does not match the email associated with the invite code.',
            }), {
                headers: Object.assign(Object.assign({}, cors_ts_1.corsHeaders), { 'Content-Type': 'application/json' }),
                status: 400,
            });
        }
        // 2. Check if a user with this email already exists
        const { data: existingUserData, error: existingUserError } = await supabaseAdmin_ts_1.supabaseAdmin
            .from('users')
            .select('id')
            .eq('email', targetEmail)
            .maybeSingle(); // Use maybeSingle to handle null result without error
        if (existingUserError && existingUserError.code !== 'PGRST116') { // PGRST116: "Searched for a single row, but found no rows"
            console.error('Error checking for existing user:', existingUserError);
            return new Response(JSON.stringify({ error: 'Error checking user existence' }), {
                headers: Object.assign(Object.assign({}, cors_ts_1.corsHeaders), { 'Content-Type': 'application/json' }),
                status: 500,
            });
        }
        if (existingUserData) {
            return new Response(JSON.stringify({ error: 'User with this email already exists' }), {
                headers: Object.assign(Object.assign({}, cors_ts_1.corsHeaders), { 'Content-Type': 'application/json' }),
                status: 409, // Conflict
            });
        }
        // 3. Create the user
        const newPassword = password || generateRandomString(16); // Generate a secure password if not provided
        const { data: authData, error: authError } = await supabaseAdmin_ts_1.supabaseAdmin.auth.signUp({
            email: targetEmail,
            password: newPassword,
            options: {
                data: Object.assign({ first_name: first_name || ((_a = inviteData.metadata) === null || _a === void 0 ? void 0 : _a.first_name) || 'User', last_name: last_name || ((_b = inviteData.metadata) === null || _b === void 0 ? void 0 : _b.last_name) || '', invited_by_code: invite_code }, (user_metadata || inviteData.metadata || {})),
                emailRedirectTo: email_redirect_to || ((_c = inviteData.metadata) === null || _c === void 0 ? void 0 : _c.email_redirect_to) || config_ts_1.LOGIN_REDIRECT_URL,
            },
        });
        if (authError || !authData.user) {
            console.error('Auth signup error:', authError);
            return new Response(JSON.stringify({ error: (authError === null || authError === void 0 ? void 0 : authError.message) || 'Failed to create user' }), {
                headers: Object.assign(Object.assign({}, cors_ts_1.corsHeaders), { 'Content-Type': 'application/json' }),
                status: 500,
            });
        }
        const user = authData.user;
        // 4. Update profile if organisation_id and role are in invite_code metadata
        if (inviteData.organisation_id && inviteData.role) {
            const { error: profileError } = await supabaseAdmin_ts_1.supabaseAdmin.from('profiles').update({
                organisation_id: inviteData.organisation_id,
                role: inviteData.role,
                first_name: user.user_metadata.first_name,
                last_name: user.user_metadata.last_name,
            }).eq('id', user.id);
            if (profileError) {
                console.error('Error updating profile with org and role:', profileError);
                // Not returning error here, as user is created, but logging it.
                // Optionally, you could implement a cleanup or a more robust transaction.
            }
        }
        else if (inviteData.organisation_id) { // Only organisation_id is present
            const { error: profileOrgError } = await supabaseAdmin_ts_1.supabaseAdmin.from('profiles').update({
                organisation_id: inviteData.organisation_id,
                first_name: user.user_metadata.first_name,
                last_name: user.user_metadata.last_name,
            }).eq('id', user.id);
            if (profileOrgError) {
                console.error('Error updating profile with org_id only:', profileOrgError);
            }
        }
        // 5. Update the invite code status to 'used' and record the user_id
        const { error: updateInviteError } = await supabaseAdmin_ts_1.supabaseAdmin
            .from('invite_codes')
            .update({ status: 'used', used_by_user_id: user.id, used_at: new Date().toISOString() })
            .eq('id', inviteData.id);
        if (updateInviteError) {
            console.error('Error updating invite code status:', updateInviteError);
            // Critical error, as user is created but invite code not marked. Consider rollback or alert.
            return new Response(JSON.stringify({ error: 'Failed to finalize invite code status.' }), {
                headers: Object.assign(Object.assign({}, cors_ts_1.corsHeaders), { 'Content-Type': 'application/json' }),
                status: 500,
            });
        }
        // If password was auto-generated, it should be communicated securely or user prompted to reset.
        // For this example, we assume email verification flow will guide them.
        // The `auth.signUp` method sends a confirmation email.
        return new Response(JSON.stringify({
            message: 'User created successfully. Please check email for confirmation.',
            user_id: user.id,
            email: user.email,
            // DO NOT return the auto-generated password here.
        }), {
            headers: Object.assign(Object.assign({}, cors_ts_1.corsHeaders), { 'Content-Type': 'application/json' }),
            status: 201, // Created
        });
    }
    catch (error) {
        console.error('Unexpected error in sign-up-with-code:', error);
        return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
            headers: Object.assign(Object.assign({}, cors_ts_1.corsHeaders), { 'Content-Type': 'application/json' }),
            status: 500,
        });
    }
});
