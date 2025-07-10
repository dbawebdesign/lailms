CREATE OR REPLACE FUNCTION public.create_assessment_with_questions(
    p_assessment_title TEXT,
    p_assessment_type public.assessment_type,
    p_base_class_id UUID,
    p_lesson_id UUID,
    p_path_id UUID,
    p_questions JSONB
)
RETURNS public.assessments AS $$
DECLARE
    new_assessment public.assessments;
    question_data JSONB;
    new_question_id UUID;
BEGIN
    -- Insert the new assessment and return its ID
    INSERT INTO public.assessments (title, assessment_type, base_class_id, lesson_id, path_id)
    VALUES (p_assessment_title, p_assessment_type, p_base_class_id, p_lesson_id, p_path_id)
    RETURNING * INTO new_assessment;

    -- Loop through the provided questions and insert them
    FOR question_data IN SELECT * FROM jsonb_array_elements(p_questions)
    LOOP
        -- Insert the question
        INSERT INTO public.questions (
            base_class_id,
            question_text,
            question_type,
            options,
            correct_answer,
            tags
        )
        VALUES (
            p_base_class_id,
            question_data->>'question_text',
            (question_data->>'question_type')::public.question_type,
            question_data->'options',
            question_data->>'correct_answer',
            (SELECT jsonb_agg(elem) FROM jsonb_array_elements_text(question_data->'tags') AS elem)
        )
        RETURNING id INTO new_question_id;

        -- Link the question to the assessment
        INSERT INTO public.assessment_questions (assessment_id, question_id)
        VALUES (new_assessment.id, new_question_id);
    END LOOP;

    -- Return the newly created assessment
    RETURN new_assessment;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 