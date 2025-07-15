import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const DEV_ADMIN_PASSWORD = 'TerroirLAI';

function validateDevAdminPassword(request: Request): boolean {
  const authHeader = request.headers.get('x-dev-admin-password');
  return authHeader === DEV_ADMIN_PASSWORD;
}

export async function GET(request: Request) {
  // Check dev admin password
  if (!validateDevAdminPassword(request)) {
    return NextResponse.json({ error: 'Unauthorized - Invalid dev admin password' }, { status: 401 });
  }

  const supabase = createSupabaseServerClient();

  try {
    // Get all organizations with member counts
    const { data: organizations, error } = await supabase
      .from('organisations')
      .select(`
        *,
        profiles(count)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching organizations:', error);
      return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 });
    }

    return NextResponse.json(organizations);
  } catch (error) {
    console.error('Error in organizations GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // Check dev admin password
  if (!validateDevAdminPassword(request)) {
    return NextResponse.json({ error: 'Unauthorized - Invalid dev admin password' }, { status: 401 });
  }

  const supabase = createSupabaseServerClient();

  try {
    const body = await request.json();
    const { name, organisation_type, settings, password } = body;

    // Also allow password in request body as fallback
    if (!validateDevAdminPassword(request) && password !== DEV_ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized - Invalid dev admin password' }, { status: 401 });
    }

    // Validate required fields
    if (!name || !organisation_type) {
      return NextResponse.json({ error: 'Name and organisation_type are required' }, { status: 400 });
    }

    // Create organization
    const { data: organization, error } = await supabase
      .from('organisations')
      .insert({
        name,
        organisation_type,
        settings: settings || {}
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating organization:', error);
      return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 });
    }

    return NextResponse.json(organization, { status: 201 });
  } catch (error) {
    console.error('Error in organizations POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 