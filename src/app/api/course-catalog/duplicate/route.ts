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

    // Get user's profile to get organisation_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organisation_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    if (!profile.organisation_id) {
      return NextResponse.json({ error: 'User must be associated with an organization to duplicate courses' }, { status: 400 });
    }

    const body = await request.json();
    const { sourceBaseClassId, newCourseName } = body;

    if (!sourceBaseClassId || !newCourseName) {
      return NextResponse.json(
        { error: 'Source base class ID and new course name are required' },
        { status: 400 }
      );
    }

    // Verify the source is a course catalog item
    const { data: sourceBaseClass, error: sourceError } = await supabase
      .from('base_classes')
      .select('*')
      .eq('id', sourceBaseClassId)
      .eq('course_catalog', true)
      .single();

    if (sourceError || !sourceBaseClass) {
      return NextResponse.json(
        { error: 'Course catalog item not found' },
        { status: 404 }
      );
    }

    // Start a transaction to duplicate everything
    // Safely extract settings as an object, defaulting to empty object if not a plain object
    const sourceSettings = sourceBaseClass.settings && 
                          typeof sourceBaseClass.settings === 'object' && 
                          !Array.isArray(sourceBaseClass.settings) 
                          ? sourceBaseClass.settings as Record<string, any>
                          : {};

    const { data: newBaseClass, error: baseClassError } = await supabase
      .from('base_classes')
      .insert({
        name: newCourseName,
        description: sourceBaseClass.description,
        organisation_id: profile.organisation_id!,
        user_id: user.id,
        settings: {
          ...sourceSettings,
          duplicated_from: sourceBaseClassId,
          duplicated_at: new Date().toISOString()
        },
        assessment_config: sourceBaseClass.assessment_config,
        course_catalog: false // This is NOT a catalog item, it's a user's copy
      })
      .select()
      .single();

    if (baseClassError) {
      console.error('Error creating new base class:', baseClassError);
      return NextResponse.json(
        { error: 'Failed to create new course' },
        { status: 500 }
      );
    }

    // Duplicate paths
    const { data: sourcePaths, error: pathsError } = await supabase
      .from('paths')
      .select('*')
      .eq('base_class_id', sourceBaseClassId)
      .order('order_index');

    if (pathsError) {
      console.error('Error fetching source paths:', pathsError);
      return NextResponse.json(
        { error: 'Failed to fetch source paths' },
        { status: 500 }
      );
    }

    const pathMapping: { [oldId: string]: string } = {};

    for (const sourcePath of sourcePaths) {
      const { data: newPath, error: newPathError } = await supabase
        .from('paths')
        .insert({
          title: sourcePath.title,
          description: sourcePath.description,
          banner_image: sourcePath.banner_image,
          level: sourcePath.level,
          published: sourcePath.published,
          organisation_id: profile.organisation_id!,
          base_class_id: newBaseClass.id,
          order_index: sourcePath.order_index,
          created_by: user.id,
          creator_user_id: user.id
        })
        .select()
        .single();

      if (newPathError) {
        console.error('Error creating new path:', newPathError);
        continue;
      }

      pathMapping[sourcePath.id] = newPath.id;
    }

    // Duplicate lessons
    const { data: sourceLessons, error: lessonsError } = await supabase
      .from('lessons')
      .select('*')
      .eq('base_class_id', sourceBaseClassId)
      .order('path_id, order_index');

    if (lessonsError) {
      console.error('Error fetching source lessons:', lessonsError);
      return NextResponse.json(
        { error: 'Failed to fetch source lessons' },
        { status: 500 }
      );
    }

    const lessonMapping: { [oldId: string]: string } = {};

    for (const sourceLesson of sourceLessons) {
      const newPathId = pathMapping[sourceLesson.path_id];
      if (!newPathId) continue;

      const { data: newLesson, error: newLessonError } = await supabase
        .from('lessons')
        .insert({
          path_id: newPathId,
          title: sourceLesson.title,
          description: sourceLesson.description,
          level: sourceLesson.level,
          banner_image: sourceLesson.banner_image,
          order_index: sourceLesson.order_index,
          published: sourceLesson.published,
          estimated_time: sourceLesson.estimated_time,
          base_class_id: newBaseClass.id,
          created_by: user.id,
          creator_user_id: user.id,
          teaching_outline_content: sourceLesson.teaching_outline_content
        })
        .select()
        .single();

      if (newLessonError) {
        console.error('Error creating new lesson:', newLessonError);
        continue;
      }

      lessonMapping[sourceLesson.id] = newLesson.id;
    }

    // Duplicate lesson sections
    const { data: sourceSections, error: sectionsError } = await supabase
      .from('lesson_sections')
      .select('*')
      .in('lesson_id', Object.keys(lessonMapping))
      .order('lesson_id, order_index');

    if (sectionsError) {
      console.error('Error fetching source sections:', sectionsError);
    } else {
      for (const sourceSection of sourceSections) {
        const newLessonId = lessonMapping[sourceSection.lesson_id];
        if (!newLessonId) continue;

        await supabase
          .from('lesson_sections')
          .insert({
            lesson_id: newLessonId,
            title: sourceSection.title,
            content: sourceSection.content,
            media_url: sourceSection.media_url,
            order_index: sourceSection.order_index,
            section_type: sourceSection.section_type,
            created_by: user.id
          });
      }
    }

    // Duplicate assessments
    const { data: sourceAssessments, error: assessmentsError } = await supabase
      .from('assessments')
      .select('*')
      .eq('base_class_id', sourceBaseClassId);

    if (assessmentsError) {
      console.error('Error fetching source assessments:', assessmentsError);
    } else {
      for (const sourceAssessment of sourceAssessments) {
        const newPathId = sourceAssessment.path_id ? pathMapping[sourceAssessment.path_id] : null;
        const newLessonId = sourceAssessment.lesson_id ? lessonMapping[sourceAssessment.lesson_id] : null;

        const { data: newAssessment, error: newAssessmentError } = await supabase
          .from('assessments')
          .insert({
            title: sourceAssessment.title,
            description: sourceAssessment.description,
            instructions: sourceAssessment.instructions,
            assessment_type: sourceAssessment.assessment_type,
            base_class_id: newBaseClass.id,
            lesson_id: newLessonId,
            path_id: newPathId,
            time_limit_minutes: sourceAssessment.time_limit_minutes,
            max_attempts: sourceAssessment.max_attempts,
            passing_score_percentage: sourceAssessment.passing_score_percentage,
            randomize_questions: sourceAssessment.randomize_questions,
            show_results_immediately: sourceAssessment.show_results_immediately,
            allow_review: sourceAssessment.allow_review,
            ai_grading_enabled: sourceAssessment.ai_grading_enabled,
            ai_model: sourceAssessment.ai_model,
            created_by: user.id,
            is_published: sourceAssessment.is_published
          })
          .select()
          .single();

        if (newAssessmentError) {
          console.error('Error creating new assessment:', newAssessmentError);
          continue;
        }

        // Duplicate assessment questions
        const { data: sourceQuestions, error: questionsError } = await supabase
          .from('assessment_questions')
          .select('*')
          .eq('assessment_id', sourceAssessment.id)
          .order('order_index');

        if (questionsError) {
          console.error('Error fetching source questions:', questionsError);
          continue;
        }

        for (const sourceQuestion of sourceQuestions) {
          await supabase
            .from('assessment_questions')
            .insert({
              assessment_id: newAssessment.id,
              question_text: sourceQuestion.question_text,
              question_type: sourceQuestion.question_type,
              points: sourceQuestion.points,
              order_index: sourceQuestion.order_index,
              required: sourceQuestion.required,
              answer_key: sourceQuestion.answer_key,
              sample_response: sourceQuestion.sample_response,
              grading_rubric: sourceQuestion.grading_rubric,
              ai_grading_enabled: sourceQuestion.ai_grading_enabled,
              options: sourceQuestion.options,
              correct_answer: sourceQuestion.correct_answer,
              explanation: sourceQuestion.explanation
            });
        }
      }
    }

    // Duplicate media assets
    const { data: sourceMediaAssets, error: mediaError } = await supabase
      .from('base_class_media_assets')
      .select('*')
      .eq('base_class_id', sourceBaseClassId);

    if (mediaError) {
      console.error('Error fetching source media assets:', mediaError);
    } else {
      for (const sourceAsset of sourceMediaAssets) {
        await supabase
          .from('base_class_media_assets')
          .insert({
            base_class_id: newBaseClass.id,
            asset_type: sourceAsset.asset_type,
            title: sourceAsset.title,
            content: sourceAsset.content,
            svg_content: sourceAsset.svg_content,
            file_url: sourceAsset.file_url,
            file_size: sourceAsset.file_size,
            duration: sourceAsset.duration,
            status: sourceAsset.status,
            created_by: user.id
          });
      }
    }

    return NextResponse.json({
      success: true,
      newBaseClassId: newBaseClass.id,
      newCourseName: newBaseClass.name,
      message: 'Course duplicated successfully'
    });

  } catch (error) {
    console.error('Error in course duplication:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
