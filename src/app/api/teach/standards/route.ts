import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const baseClassId = searchParams.get('baseClassId');

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Build query for standards
    let query = supabase
      .from('standards')
      .select(`
        id,
        name,
        description,
        code,
        category,
        organization_id,
        created_at,
        updated_at,
        assignment_standards(
          assignment_id,
          assignments(
            id,
            title
          )
        )
      `);

    // Filter by organization if provided
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    } else if (baseClassId) {
      // If baseClassId is provided, get standards for that base class's organization
      const { data: baseClass, error: baseClassError } = await supabase
        .from('base_classes')
        .select('organization_id')
        .eq('id', baseClassId)
        .eq('user_id', user.id)
        .single();

      if (baseClassError || !baseClass) {
        return NextResponse.json({ error: 'Base class not found or access denied' }, { status: 404 });
      }

      query = query.eq('organization_id', baseClass.organization_id);
    } else {
      // Get user's organization
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profile?.organization_id) {
        return NextResponse.json({ error: 'User organization not found' }, { status: 404 });
      }

      query = query.eq('organization_id', profile.organization_id);
    }

    const { data: standards, error: standardsError } = await query.order('category', { ascending: true });

    if (standardsError) {
      return NextResponse.json({ error: 'Failed to fetch standards' }, { status: 500 });
    }

    return NextResponse.json({ standards: standards || [] });

  } catch (error) {
    console.error('Error fetching standards:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const body = await request.json();
    
    const {
      name,
      description,
      code,
      category,
      organization_id
    } = body;

    if (!name || !description) {
      return NextResponse.json({ 
        error: 'name and description are required' 
      }, { status: 400 });
    }

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Determine organization_id
    let finalOrganizationId = organization_id;
    if (!finalOrganizationId) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profile?.organization_id) {
        return NextResponse.json({ error: 'User organization not found' }, { status: 404 });
      }

      finalOrganizationId = profile.organization_id;
    }

    // Verify user has access to this organization
    const { data: orgAccess, error: orgError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_id', finalOrganizationId)
      .single();

    if (orgError || !orgAccess) {
      return NextResponse.json({ error: 'Access denied to this organization' }, { status: 403 });
    }

    // Create standard
    const { data: standard, error: standardError } = await supabase
      .from('standards')
      .insert({
        name,
        description,
        code,
        category,
        organization_id: finalOrganizationId
      })
      .select()
      .single();

    if (standardError) {
      return NextResponse.json({ error: 'Failed to create standard' }, { status: 500 });
    }

    // Broadcast real-time update to all organization channels
    const channel = supabase.channel(`organization:${finalOrganizationId}`);
    await channel.send({
      type: 'broadcast',
      event: 'standard_update',
      payload: {
        type: 'standard_created',
        standard,
        organization_id: finalOrganizationId
      }
    });

    return NextResponse.json({ standard }, { status: 201 });

  } catch (error) {
    console.error('Error creating standard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const body = await request.json();
    
    const {
      id,
      name,
      description,
      code,
      category
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Standard ID is required' }, { status: 400 });
    }

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user has access to this standard
    const { data: standard, error: standardError } = await supabase
      .from('standards')
      .select(`
        id,
        organization_id,
        profiles!inner(
          user_id
        )
      `)
      .eq('id', id)
      .eq('profiles.user_id', user.id)
      .single();

    if (standardError || !standard) {
      return NextResponse.json({ error: 'Standard not found or access denied' }, { status: 404 });
    }

    // Update standard
    const updateData: any = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (code !== undefined) updateData.code = code;
    if (category !== undefined) updateData.category = category;

    const { data: updatedStandard, error: updateError } = await supabase
      .from('standards')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update standard' }, { status: 500 });
    }

    // Broadcast real-time update to all organization channels
    const channel = supabase.channel(`organization:${standard.organization_id}`);
    await channel.send({
      type: 'broadcast',
      event: 'standard_update',
      payload: {
        type: 'standard_updated',
        standard: updatedStandard,
        organization_id: standard.organization_id
      }
    });

    return NextResponse.json({ standard: updatedStandard });

  } catch (error) {
    console.error('Error updating standard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Standard ID is required' }, { status: 400 });
    }

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user has access to this standard
    const { data: standard, error: standardError } = await supabase
      .from('standards')
      .select(`
        id,
        organization_id,
        profiles!inner(
          user_id
        )
      `)
      .eq('id', id)
      .eq('profiles.user_id', user.id)
      .single();

    if (standardError || !standard) {
      return NextResponse.json({ error: 'Standard not found or access denied' }, { status: 404 });
    }

    // Check if standard is being used by any assignments
    const { data: assignmentStandards, error: checkError } = await supabase
      .from('assignment_standards')
      .select('assignment_id')
      .eq('standard_id', id)
      .limit(1);

    if (checkError) {
      return NextResponse.json({ error: 'Failed to check standard usage' }, { status: 500 });
    }

    if (assignmentStandards && assignmentStandards.length > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete standard that is being used by assignments' 
      }, { status: 400 });
    }

    // Delete standard
    const { error: deleteError } = await supabase
      .from('standards')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to delete standard' }, { status: 500 });
    }

    // Broadcast real-time update to all organization channels
    const channel = supabase.channel(`organization:${standard.organization_id}`);
    await channel.send({
      type: 'broadcast',
      event: 'standard_update',
      payload: {
        type: 'standard_deleted',
        standard,
        organization_id: standard.organization_id
      }
    });

    return NextResponse.json({ message: 'Standard deleted successfully' });

  } catch (error) {
    console.error('Error deleting standard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 