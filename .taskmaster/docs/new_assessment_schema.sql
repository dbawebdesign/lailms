-- =====================================================
-- NEW SIMPLIFIED ASSESSMENT SCHEMA (4 TABLES)
-- =====================================================
-- This schema replaces the complex 19-table system with a simplified 4-table approach
-- Supports 5 question types: multiple_choice, true_false, short_answer, essay, matching
-- Enhanced with AI-powered grading capabilities for short_answer and essay questions
-- =====================================================

-- =====================================================
-- 1. ASSESSMENTS TABLE
-- =====================================================
-- Main assessment definitions for lessons, paths, and classes
CREATE TABLE assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Basic Information
    title TEXT NOT NULL,
    description TEXT,
    instructions TEXT,
    
    -- Assessment Type & Context
    assessment_type TEXT NOT NULL CHECK (assessment_type IN ('lesson', 'path', 'class')),
    
    -- Foreign Key Relationships
    base_class_id UUID NOT NULL REFERENCES base_classes(id) ON DELETE CASCADE,
    lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
    path_id UUID REFERENCES paths(id) ON DELETE CASCADE,
    
    -- Constraints for proper assessment type relationships
    CONSTRAINT check_lesson_assessment CHECK (
        (assessment_type = 'lesson' AND lesson_id IS NOT NULL AND path_id IS NULL) OR
        (assessment_type = 'path' AND path_id IS NOT NULL AND lesson_id IS NULL) OR
        (assessment_type = 'class' AND lesson_id IS NULL AND path_id IS NULL)
    ),
    
    -- Assessment Configuration
    time_limit_minutes INTEGER, -- NULL = no time limit
    max_attempts INTEGER DEFAULT 3,
    passing_score_percentage INTEGER DEFAULT 70 CHECK (passing_score_percentage BETWEEN 0 AND 100),
    randomize_questions BOOLEAN DEFAULT false,
    show_correct_answers BOOLEAN DEFAULT true,
    show_explanations BOOLEAN DEFAULT true,
    
    -- AI Grading Configuration
    ai_grading_enabled BOOLEAN DEFAULT true,
    ai_grading_model TEXT DEFAULT 'gpt-4.1-mini',
    
    -- Status & Metadata
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES profiles(id),
    
    -- Indexes
    INDEX idx_assessments_base_class (base_class_id),
    INDEX idx_assessments_lesson (lesson_id),
    INDEX idx_assessments_path (path_id),
    INDEX idx_assessments_type (assessment_type),
    INDEX idx_assessments_published (is_published)
);

-- =====================================================
-- 2. ASSESSMENT_QUESTIONS TABLE
-- =====================================================
-- Individual questions with enhanced support for 5 question types
CREATE TABLE assessment_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Assessment Relationship
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    
    -- Question Content
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'true_false', 'short_answer', 'essay', 'matching')),
    
    -- Question Configuration
    points INTEGER NOT NULL DEFAULT 1 CHECK (points > 0),
    order_index INTEGER NOT NULL DEFAULT 0,
    is_required BOOLEAN DEFAULT true,
    
    -- Question Data (JSON structures specific to each question type)
    options JSONB, -- Question-specific options structure
    correct_answer JSONB, -- Expected answer(s)
    answer_key JSONB NOT NULL, -- Enhanced answer key with explanations and grading criteria
    
    -- AI Grading Support (for short_answer and essay types)
    sample_response TEXT, -- Model answer for AI comparison
    
    -- Question Metadata
    difficulty_score INTEGER DEFAULT 5 CHECK (difficulty_score BETWEEN 1 AND 10),
    cognitive_level TEXT DEFAULT 'understand' CHECK (cognitive_level IN ('remember', 'understand', 'apply', 'analyze', 'evaluate', 'create')),
    explanation TEXT, -- General explanation for the question
    
    -- Source Content Reference
    source_content_id UUID, -- Reference to lesson section or content that generated this question
    source_content_type TEXT, -- 'lesson_section', 'knowledge_base_chunk', etc.
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_questions_assessment (assessment_id),
    INDEX idx_questions_type (question_type),
    INDEX idx_questions_order (assessment_id, order_index),
    INDEX idx_questions_difficulty (difficulty_score),
    INDEX idx_questions_source (source_content_id, source_content_type)
);

-- =====================================================
-- 3. STUDENT_ATTEMPTS TABLE
-- =====================================================
-- Track student assessment attempts with progress monitoring
CREATE TABLE student_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Student & Assessment
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    
    -- Attempt Information
    attempt_number INTEGER NOT NULL DEFAULT 1,
    
    -- Progress Tracking
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned', 'timed_out')),
    current_question_index INTEGER DEFAULT 0,
    total_questions INTEGER NOT NULL,
    questions_answered INTEGER DEFAULT 0,
    
    -- Scoring
    total_points_possible INTEGER NOT NULL,
    total_points_earned DECIMAL(10,2) DEFAULT 0,
    percentage_score DECIMAL(5,2) DEFAULT 0 CHECK (percentage_score BETWEEN 0 AND 100),
    is_passing BOOLEAN DEFAULT false,
    
    -- Timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    time_spent_seconds INTEGER DEFAULT 0,
    time_limit_seconds INTEGER, -- Copied from assessment at start
    
    -- AI Grading Status
    ai_grading_status TEXT DEFAULT 'pending' CHECK (ai_grading_status IN ('pending', 'in_progress', 'completed', 'failed')),
    ai_grading_completed_at TIMESTAMPTZ,
    
    -- Metadata
    ip_address INET,
    user_agent TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint: one active attempt per student per assessment
    UNIQUE (student_id, assessment_id, attempt_number),
    
    -- Indexes
    INDEX idx_attempts_student (student_id),
    INDEX idx_attempts_assessment (assessment_id),
    INDEX idx_attempts_status (status),
    INDEX idx_attempts_student_assessment (student_id, assessment_id),
    INDEX idx_attempts_ai_grading (ai_grading_status)
);

-- =====================================================
-- 4. STUDENT_RESPONSES TABLE
-- =====================================================
-- Individual question responses with AI grading support
CREATE TABLE student_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationships
    attempt_id UUID NOT NULL REFERENCES student_attempts(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES assessment_questions(id) ON DELETE CASCADE,
    
    -- Response Data
    response_data JSONB NOT NULL, -- Student's answer in question-type-specific format
    
    -- Grading Results
    is_correct BOOLEAN,
    points_earned DECIMAL(10,2) DEFAULT 0,
    points_possible INTEGER NOT NULL,
    partial_credit_score DECIMAL(5,4) DEFAULT 0 CHECK (partial_credit_score BETWEEN 0 AND 1),
    
    -- AI Grading (for short_answer and essay types)
    ai_grading_score DECIMAL(5,4), -- 0-1 score from AI
    ai_grading_feedback TEXT, -- AI-generated feedback
    ai_grading_confidence DECIMAL(5,4), -- AI confidence level 0-1
    ai_grading_model TEXT, -- Model used for grading
    ai_graded_at TIMESTAMPTZ,
    
    -- Manual Override (instructor can override AI grading)
    manual_override_score DECIMAL(10,2),
    manual_override_feedback TEXT,
    manual_override_by UUID REFERENCES profiles(id),
    manual_override_at TIMESTAMPTZ,
    
    -- Response Metadata
    time_spent_seconds INTEGER DEFAULT 0,
    is_flagged BOOLEAN DEFAULT false, -- For review
    flag_reason TEXT,
    
    -- Timestamps
    answered_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint: one response per question per attempt
    UNIQUE (attempt_id, question_id),
    
    -- Indexes
    INDEX idx_responses_attempt (attempt_id),
    INDEX idx_responses_question (question_id),
    INDEX idx_responses_grading (ai_grading_score),
    INDEX idx_responses_flagged (is_flagged),
    INDEX idx_responses_manual_override (manual_override_by)
);

-- =====================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Update timestamps trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to all tables
CREATE TRIGGER update_assessments_updated_at BEFORE UPDATE ON assessments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_assessment_questions_updated_at BEFORE UPDATE ON assessment_questions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_student_attempts_updated_at BEFORE UPDATE ON student_attempts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_student_responses_updated_at BEFORE UPDATE ON student_responses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_responses ENABLE ROW LEVEL SECURITY;

-- Assessments policies
CREATE POLICY "Instructors can manage assessments for their base classes" ON assessments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM base_classes bc 
            WHERE bc.id = assessments.base_class_id 
            AND bc.instructor_id = auth.uid()
        )
    );

CREATE POLICY "Students can view published assessments in their enrolled classes" ON assessments
    FOR SELECT USING (
        is_published = true AND
        EXISTS (
            SELECT 1 FROM enrollments e
            JOIN base_classes bc ON bc.id = e.base_class_id
            WHERE bc.id = assessments.base_class_id 
            AND e.student_id = auth.uid()
            AND e.status = 'active'
        )
    );

-- Assessment questions policies
CREATE POLICY "Instructors can manage questions for their assessments" ON assessment_questions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM assessments a
            JOIN base_classes bc ON bc.id = a.base_class_id
            WHERE a.id = assessment_questions.assessment_id 
            AND bc.instructor_id = auth.uid()
        )
    );

CREATE POLICY "Students can view questions for published assessments they're enrolled in" ON assessment_questions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM assessments a
            JOIN base_classes bc ON bc.id = a.base_class_id
            JOIN enrollments e ON e.base_class_id = bc.id
            WHERE a.id = assessment_questions.assessment_id 
            AND a.is_published = true
            AND e.student_id = auth.uid()
            AND e.status = 'active'
        )
    );

-- Student attempts policies
CREATE POLICY "Students can manage their own attempts" ON student_attempts
    FOR ALL USING (student_id = auth.uid());

CREATE POLICY "Instructors can view attempts for their assessments" ON student_attempts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM assessments a
            JOIN base_classes bc ON bc.id = a.base_class_id
            WHERE a.id = student_attempts.assessment_id 
            AND bc.instructor_id = auth.uid()
        )
    );

-- Student responses policies
CREATE POLICY "Students can manage their own responses" ON student_responses
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM student_attempts sa
            WHERE sa.id = student_responses.attempt_id 
            AND sa.student_id = auth.uid()
        )
    );

CREATE POLICY "Instructors can view responses for their assessments" ON student_responses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM student_attempts sa
            JOIN assessments a ON a.id = sa.assessment_id
            JOIN base_classes bc ON bc.id = a.base_class_id
            WHERE sa.id = student_responses.attempt_id 
            AND bc.instructor_id = auth.uid()
        )
    );

-- =====================================================
-- EXAMPLE JSON STRUCTURES FOR EACH QUESTION TYPE
-- =====================================================

/*
MULTIPLE CHOICE:
{
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correct_answer": "A",
  "answer_key": {
    "A": "Correct! This is the right answer because...",
    "B": "Incorrect. This option is wrong because...",
    "C": "Incorrect. This option is wrong because...",
    "D": "Incorrect. This option is wrong because..."
  }
}

TRUE/FALSE:
{
  "options": ["True", "False"],
  "correct_answer": "True",
  "answer_key": {
    "explanation": "This statement is true because...",
    "true_explanation": "Why this is true...",
    "false_explanation": "Why false would be wrong..."
  }
}

SHORT ANSWER:
{
  "options": null,
  "correct_answer": "Expected answer text",
  "answer_key": {
    "keywords": ["keyword1", "keyword2", "keyword3"],
    "explanation": "Complete explanation of the answer",
    "grading_criteria": "What to look for when grading",
    "min_score_threshold": 0.7,
    "semantic_weight": 0.6,
    "keyword_weight": 0.4
  },
  "sample_response": "Model answer that demonstrates the expected response quality and content"
}

ESSAY:
{
  "options": null,
  "correct_answer": null,
  "answer_key": {
    "rubric": {
      "content_knowledge": {
        "description": "Demonstrates understanding of key concepts",
        "points": 25,
        "excellent": "Shows deep understanding...",
        "good": "Shows adequate understanding...",
        "poor": "Shows limited understanding..."
      },
      "critical_thinking": {
        "description": "Analyzes and evaluates information effectively",
        "points": 25,
        "excellent": "Provides insightful analysis...",
        "good": "Provides adequate analysis...",
        "poor": "Provides superficial analysis..."
      }
    },
    "grading_guidelines": "Overall guidelines for grading this essay",
    "semantic_weight": 0.4,
    "rubric_weight": 0.6
  },
  "sample_response": "Model essay that demonstrates excellent response quality"
}

MATCHING:
{
  "options": {
    "left": ["Term 1", "Term 2", "Term 3"],
    "right": ["Definition A", "Definition B", "Definition C"]
  },
  "correct_answer": {
    "Term 1": "Definition A",
    "Term 2": "Definition B", 
    "Term 3": "Definition C"
  },
  "answer_key": {
    "explanations": {
      "Term 1": "Explanation for why Term 1 matches Definition A",
      "Term 2": "Explanation for why Term 2 matches Definition B",
      "Term 3": "Explanation for why Term 3 matches Definition C"
    }
  }
}
*/ 