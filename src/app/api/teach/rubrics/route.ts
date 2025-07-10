import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { RubricService, CreateRubricRequest } from '@/lib/services/rubric-service';

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const baseClassId = searchParams.get('baseClassId');
    const templatesOnly = searchParams.get('templates') === 'true';

    const rubricService = new RubricService();

    if (templatesOnly) {
      const rubrics = await rubricService.getTemplateRubrics();
      return NextResponse.json({ rubrics });
    }

    if (baseClassId) {
      const rubrics = await rubricService.getClassRubrics(baseClassId);
      return NextResponse.json({ rubrics });
    }

    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching rubrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rubrics' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      description,
      baseClassId,
      rubricType,
      gradingScale,
      scaleDefinition,
      criteria,
      isTemplate,
      tags
    } = body;

    // Validate required fields
    if (!name || !rubricType || !gradingScale || !criteria || !Array.isArray(criteria)) {
      return NextResponse.json(
        { error: 'Missing required fields: name, rubricType, gradingScale, criteria' },
        { status: 400 }
      );
    }

    // Validate criteria structure
    for (const criterion of criteria) {
      if (!criterion.name || typeof criterion.weight !== 'number' || 
          typeof criterion.maxPoints !== 'number' || !Array.isArray(criterion.performanceLevels)) {
        return NextResponse.json(
          { error: 'Invalid criterion structure' },
          { status: 400 }
        );
      }
    }

    const createRequest: CreateRubricRequest = {
      name,
      description,
      baseClassId,
      rubricType,
      gradingScale,
      scaleDefinition,
      criteria,
      isTemplate,
      tags
    };

    const rubricService = new RubricService();
    const result = await rubricService.createRubric(createRequest, user.id);

    return NextResponse.json({
      success: true,
      rubric: result.rubric,
      criteria: result.criteria
    });
  } catch (error) {
    console.error('Error creating rubric:', error);
    return NextResponse.json(
      { error: 'Failed to create rubric' },
      { status: 500 }
    );
  }
} 