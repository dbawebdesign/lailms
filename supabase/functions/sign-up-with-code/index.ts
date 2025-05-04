// Follow this pattern to use Supabase client in Edge Functions
// See more examples on https://supabase.com/docs/guides/functions/examples

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

interface SignUpRequest {
  inviteCode: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  gradeLevel?: string;
}

interface InviteCode {
  id: string;
  code: string;
  role: string;
  organisation_id: string;
  is_redeemed: boolean;
  expires_at: string | null;
}

interface Organisation {
  id: string;
  name: string;
  abbr: string;
}

Deno.serve(async (req) => {
  try {
    // Handle CORS for OPTIONS request
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      });
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const requestData: SignUpRequest = await req.json();
    const { inviteCode, username, password, firstName, lastName, gradeLevel } = requestData;

    // Validate required fields
    if (!inviteCode || !username || !password || !firstName || !lastName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if invite code exists and is valid
    const { data: inviteData, error: inviteError } = await supabase
      .from('invite_codes')
      .select('id, code, role, organisation_id, is_redeemed, expires_at')
      .eq('code', inviteCode)
      .single();

    if (inviteError || !inviteData) {
      return new Response(
        JSON.stringify({ error: 'Invalid invite code' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const invite = inviteData as InviteCode;

    // Check if code is already redeemed
    if (invite.is_redeemed) {
      return new Response(
        JSON.stringify({ error: 'Invite code has already been used' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if code is expired
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Invite code has expired' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get organisation abbreviation for pseudo-email
    const { data: orgData, error: orgError } = await supabase
      .from('organisations')
      .select('id, name, abbr')
      .eq('id', invite.organisation_id)
      .single();

    if (orgError || !orgData) {
      return new Response(
        JSON.stringify({ error: 'Organisation not found' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const organisation = orgData as Organisation;

    // Check if username is already taken
    const { data: existingUser, error: userCheckError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('username', username)
      .limit(1);

    if (existingUser && existingUser.length > 0) {
      return new Response(
        JSON.stringify({ error: 'Username is already taken' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create a pseudo-email for authentication
    const pseudoEmail = `${username}@${organisation.abbr}.internal`;

    // Create the user in auth.users
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: pseudoEmail,
      password: password,
      email_confirm: true, // Skip email verification
      user_metadata: {
        role: invite.role,
        organisation_id: invite.organisation_id,
        first_name: firstName,
        last_name: lastName,
        grade_level: gradeLevel,
      },
    });

    if (authError || !authUser) {
      return new Response(
        JSON.stringify({ error: 'Error creating user', details: authError }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create profile record
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        user_id: authUser.user.id,
        username: username,
        first_name: firstName,
        last_name: lastName,
        grade_level: gradeLevel,
        role: invite.role,
        organisation_id: invite.organisation_id,
      });

    if (profileError) {
      // Attempt to rollback auth user if profile creation fails
      await supabase.auth.admin.deleteUser(authUser.user.id);
      
      return new Response(
        JSON.stringify({ error: 'Error creating profile', details: profileError }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Mark invite code as redeemed
    const { error: updateError } = await supabase
      .from('invite_codes')
      .update({
        is_redeemed: true,
        redeemed_by: authUser.user.id,
        redeemed_at: new Date().toISOString(),
      })
      .eq('id', invite.id);

    if (updateError) {
      console.error('Error updating invite code', updateError);
      // Continue anyway as user is created successfully
    }

    // Return success with user data
    return new Response(
      JSON.stringify({
        message: 'User created successfully',
        user: {
          id: authUser.user.id,
          username: username,
          role: invite.role,
          organisation_id: invite.organisation_id,
        },
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}); 