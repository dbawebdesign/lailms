import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { baseClassId, organisationId, timeWindowMinutes = 10 } = body;

    // Validate required fields
    if (!baseClassId || !organisationId) {
      return NextResponse.json(
        { error: 'Base class ID and organisation ID are required' }, 
        { status: 400 }
      );
    }

    // Verify user has access to the organization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organisation_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || profile?.organisation_id !== organisationId) {
      return NextResponse.json(
        { error: 'Invalid organization access' }, 
        { status: 403 }
      );
    }

    // Verify the base class exists and belongs to the user
    const { data: baseClass, error: baseClassError } = await supabase
      .from('base_classes')
      .select('id, name')
      .eq('id', baseClassId)
      .eq('user_id', user.id)
      .eq('organisation_id', organisationId)
      .single();

    if (baseClassError || !baseClass) {
      return NextResponse.json(
        { error: 'Base class not found or access denied' }, 
        { status: 404 }
      );
    }

    // Find recent documents uploaded by this user that aren't already associated with a base class
    const cutoffTime = new Date(Date.now() - (timeWindowMinutes * 60 * 1000)).toISOString();
    
    const { data: recentDocuments, error: documentsError } = await supabase
      .from('documents')
      .select('id, file_name, created_at')
      .eq('organisation_id', organisationId)
      .eq('uploaded_by', user.id)
      .is('base_class_id', null) // Only unassociated documents
      .gte('created_at', cutoffTime)
      .order('created_at', { ascending: false });

    if (documentsError) {
      console.error('Error fetching recent documents:', documentsError);
      return NextResponse.json(
        { error: 'Failed to fetch recent documents' }, 
        { status: 500 }
      );
    }

    if (!recentDocuments || recentDocuments.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No recent unassociated documents found to associate with base class',
        documentsAssociated: 0,
        baseClassName: baseClass.name
      });
    }

    // Associate the recent documents with the base class
    const documentIds = recentDocuments.map(doc => doc.id);
    
    const { data: updatedDocuments, error: updateError } = await supabase
      .from('documents')
      .update({ base_class_id: baseClassId })
      .in('id', documentIds)
      .select('id, file_name');

    if (updateError) {
      console.error('Error associating documents with base class:', updateError);
      return NextResponse.json(
        { error: 'Failed to associate documents with base class' }, 
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully associated ${recentDocuments.length} document(s) with base class`,
      documentsAssociated: recentDocuments.length,
      baseClassName: baseClass.name,
      documents: recentDocuments.map(doc => ({
        id: doc.id,
        fileName: doc.file_name,
        uploadedAt: doc.created_at
      }))
    });

  } catch (error) {
    console.error('Associate documents with base class error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
} 