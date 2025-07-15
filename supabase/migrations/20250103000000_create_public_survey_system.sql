-- Create Public Survey System Migration
-- This migration creates a public survey system for non-authenticated users

-- Create public_survey_sections table
CREATE TABLE public_survey_sections (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create public_survey_questions table
CREATE TABLE public_survey_questions (
    id SERIAL PRIMARY KEY,
    section_id INTEGER REFERENCES public_survey_sections(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) NOT NULL CHECK (question_type IN ('likert', 'multiple_choice', 'numerical', 'scale', 'text')),
    options JSONB,
    required BOOLEAN DEFAULT true,
    order_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create public_survey_responses table (no user_id since it's public)
CREATE TABLE public_survey_responses (
    id SERIAL PRIMARY KEY,
    session_id UUID DEFAULT gen_random_uuid(),
    email VARCHAR(255), -- Optional email for follow-up
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    duration_seconds INTEGER,
    device_info JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create public_survey_question_responses table
CREATE TABLE public_survey_question_responses (
    id SERIAL PRIMARY KEY,
    survey_response_id INTEGER REFERENCES public_survey_responses(id) ON DELETE CASCADE,
    question_id INTEGER REFERENCES public_survey_questions(id) ON DELETE CASCADE,
    response_value TEXT,
    response_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_public_survey_sections_order ON public_survey_sections(order_index);
CREATE INDEX idx_public_survey_questions_section ON public_survey_questions(section_id, order_index);
CREATE INDEX idx_public_survey_responses_session ON public_survey_responses(session_id);
CREATE INDEX idx_public_survey_responses_completed ON public_survey_responses(completed_at);
CREATE INDEX idx_public_survey_question_responses_survey ON public_survey_question_responses(survey_response_id);
CREATE INDEX idx_public_survey_question_responses_question ON public_survey_question_responses(question_id);

-- Enable RLS on all tables
ALTER TABLE public_survey_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_survey_question_responses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for public access
-- Sections and questions are publicly readable
CREATE POLICY "Public survey sections are readable by everyone" ON public_survey_sections FOR SELECT USING (true);
CREATE POLICY "Public survey questions are readable by everyone" ON public_survey_questions FOR SELECT USING (true);

-- Responses can be inserted by anyone (public submission)
CREATE POLICY "Anyone can submit public survey responses" ON public_survey_responses FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can submit public survey question responses" ON public_survey_question_responses FOR INSERT WITH CHECK (true);

-- Only authenticated users (admins) can view responses
CREATE POLICY "Only authenticated users can view public survey responses" ON public_survey_responses FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Only authenticated users can view public survey question responses" ON public_survey_question_responses FOR SELECT USING (auth.role() = 'authenticated');

-- Admin users can manage sections and questions
CREATE POLICY "Admins can manage public survey sections" ON public_survey_sections FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.user_id = auth.uid() 
        AND profiles.role IN ('super_admin', 'admin')
    )
);

CREATE POLICY "Admins can manage public survey questions" ON public_survey_questions FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.user_id = auth.uid() 
        AND profiles.role IN ('super_admin', 'admin')
    )
);

-- Insert sample survey sections and questions
INSERT INTO public_survey_sections (title, description, order_index) VALUES 
('Problem Validation', 'Help us understand the challenges you face in homeschooling', 1),
('Product Interest', 'Rate the importance of various features and tools', 2),
('Demographics', 'Tell us a bit about yourself and your homeschooling situation', 3),
('Feedback', 'Share your thoughts and suggestions', 4);

-- Insert sample questions for Problem Validation section
INSERT INTO public_survey_questions (section_id, question_text, question_type, options, order_index) VALUES 
(1, 'I find it challenging to regularly source or design quality curriculum.', 'likert', '{"scale": ["Strongly Disagree", "Disagree", "Somewhat Agree", "Agree", "Strongly Agree"]}', 1),
(1, 'I spend too much time each week on lesson planning.', 'likert', '{"scale": ["Strongly Disagree", "Disagree", "Somewhat Agree", "Agree", "Strongly Agree"]}', 2),
(1, 'I think that current learning tools available lack significant personalization for students.', 'likert', '{"scale": ["Strongly Disagree", "Disagree", "Somewhat Agree", "Agree", "Strongly Agree"]}', 3),
(1, 'I often experience homeschool burnout or feel overwhelmed.', 'likert', '{"scale": ["Strongly Disagree", "Disagree", "Somewhat Agree", "Agree", "Strongly Agree"]}', 4);

-- Insert sample questions for Product Interest section
INSERT INTO public_survey_questions (section_id, question_text, question_type, options, order_index) VALUES 
(2, 'AI powered curriculum generator', 'likert', '{"scale": ["Very Unimportant", "Unimportant", "Neutral", "Somewhat Important", "Very Important"]}', 1),
(2, 'Automated AI adaptation to learning styles', 'likert', '{"scale": ["Very Unimportant", "Unimportant", "Neutral", "Somewhat Important", "Very Important"]}', 2),
(2, 'Progress tracking and assessment tools', 'likert', '{"scale": ["Very Unimportant", "Unimportant", "Neutral", "Somewhat Important", "Very Important"]}', 3),
(2, 'Collaborative learning features', 'likert', '{"scale": ["Very Unimportant", "Unimportant", "Neutral", "Somewhat Important", "Very Important"]}', 4);

-- Insert sample questions for Demographics section
INSERT INTO public_survey_questions (section_id, question_text, question_type, options, order_index) VALUES 
(3, 'How many children do you homeschool?', 'numerical', '{"min": 1, "max": 10, "placeholder": "Enter number"}', 1),
(3, 'What is your primary homeschooling style?', 'multiple_choice', '{"options": ["Traditional/Structured", "Charlotte Mason", "Montessori", "Unschooling", "Eclectic", "Unit Studies", "Other"], "multiple": false}', 2),
(3, 'What grade levels do you currently teach?', 'multiple_choice', '{"options": ["Pre-K", "Kindergarten", "1st Grade", "2nd Grade", "3rd Grade", "4th Grade", "5th Grade", "6th Grade", "7th Grade", "8th Grade", "9th Grade", "10th Grade", "11th Grade", "12th Grade"], "multiple": true}', 3),
(3, 'How long have you been homeschooling?', 'multiple_choice', '{"options": ["Less than 1 year", "1-2 years", "3-5 years", "6-10 years", "More than 10 years"], "multiple": false}', 4);

-- Insert sample questions for Feedback section
INSERT INTO public_survey_questions (section_id, question_text, question_type, options, order_index) VALUES 
(4, 'What is your biggest challenge in homeschooling?', 'text', '{"placeholder": "Please share your biggest challenge...", "type": "textarea"}', 1),
(4, 'What features would you most like to see in an AI-powered homeschooling platform?', 'text', '{"placeholder": "Describe the features you would find most helpful...", "type": "textarea"}', 2),
(4, 'Any additional comments or suggestions?', 'text', '{"placeholder": "Share any other thoughts...", "type": "textarea"}', 3);

-- Create function to get public survey statistics
CREATE OR REPLACE FUNCTION get_public_survey_stats()
RETURNS TABLE (
    total_responses BIGINT,
    completed_today BIGINT,
    avg_duration_minutes NUMERIC,
    completion_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_responses,
        COUNT(CASE WHEN completed_at::date = CURRENT_DATE THEN 1 END) as completed_today,
        ROUND(AVG(duration_seconds) / 60.0, 2) as avg_duration_minutes,
        ROUND(
            (COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END)::NUMERIC / 
             NULLIF(COUNT(*), 0)) * 100, 2
        ) as completion_rate
    FROM public_survey_responses;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_public_survey_stats() TO authenticated; 