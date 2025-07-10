# Existing Assessment Schema Documentation

## Overview
This document provides comprehensive documentation of the existing assessment-related database schema that will be removed as part of the assessment system rebuild. This includes 19 tables and 9 functions that will be replaced with a simplified 4-table structure.

## Tables to be Removed (19 total)

### 1. assessment_analytics
**Purpose**: Stores analytics data for assessments
**Columns**:
- id (uuid, NOT NULL, DEFAULT gen_random_uuid())
- assessment_id (uuid, NOT NULL)
- assessment_type (USER-DEFINED, NOT NULL)
- total_attempts (integer, DEFAULT 0)
- unique_users (integer, DEFAULT 0)
- avg_score (numeric)
- avg_completion_time (integer)
- pass_rate (numeric)
- difficulty_rating (numeric)
- question_count (integer, DEFAULT 0)
- last_calculated_at (timestamp with time zone, DEFAULT now())
- metadata (jsonb, DEFAULT '{}')
- created_at (timestamp with time zone, DEFAULT now())
- updated_at (timestamp with time zone, DEFAULT now())

### 2. assessment_answers
**Purpose**: Stores individual answers to assessment questions
**Columns**:
- id (uuid, NOT NULL, DEFAULT gen_random_uuid())
- attempt_id (uuid, NOT NULL) → REFERENCES assessment_attempts(id)
- question_id (uuid, NOT NULL) → REFERENCES questions(id)
- user_answer (jsonb)
- is_correct (boolean)
- submitted_at (timestamp with time zone, NOT NULL, DEFAULT now())
- created_at (timestamp with time zone, NOT NULL, DEFAULT now())
- updated_at (timestamp with time zone, NOT NULL, DEFAULT now())

### 3. assessment_attempts
**Purpose**: Tracks individual attempts at assessments
**Columns**:
- id (uuid, NOT NULL, DEFAULT gen_random_uuid())
- assessment_type (USER-DEFINED, NOT NULL)
- assessment_id (uuid, NOT NULL)
- lesson_id (uuid) → REFERENCES lessons(id)
- path_id (uuid) → REFERENCES paths(id)
- base_class_id (uuid) → REFERENCES base_classes(id)
- attempt_number (integer, NOT NULL, DEFAULT 1)
- started_at (timestamp with time zone, NOT NULL, DEFAULT now())
- completed_at (timestamp with time zone)
- time_spent (integer)
- total_questions (integer, NOT NULL, DEFAULT 0)
- correct_answers (integer, DEFAULT 0)
- score (numeric)
- passed (boolean)
- feedback (text)
- metadata (jsonb, DEFAULT '{}')
- created_at (timestamp with time zone, NOT NULL, DEFAULT now())
- updated_at (timestamp with time zone, NOT NULL, DEFAULT now())
- user_id (uuid)
- status (text, NOT NULL, DEFAULT 'in_progress')

### 4. assessment_media
**Purpose**: Stores media files associated with assessments
**Columns**:
- id (uuid, NOT NULL, DEFAULT gen_random_uuid())
- assessment_session_id (uuid) → REFERENCES assessment_sessions(id)
- question_id (uuid) → REFERENCES questions(id)
- oral_exam_session_id (uuid) → REFERENCES oral_exam_sessions(id)
- media_type (text, NOT NULL)
- file_name (text, NOT NULL)
- file_size (bigint)
- mime_type (text)
- storage_path (text, NOT NULL)
- storage_bucket (text, NOT NULL)
- metadata (jsonb, DEFAULT '{}')
- uploaded_by (uuid) → REFERENCES members(id)
- created_at (timestamp with time zone, NOT NULL, DEFAULT now())

### 5. assessment_questions
**Purpose**: Links assessments to questions
**Columns**:
- id (uuid, NOT NULL, DEFAULT gen_random_uuid())
- assessment_id (uuid) → REFERENCES assessments(id)
- question_id (uuid) → REFERENCES questions(id)
- display_order (integer)
- created_at (timestamp with time zone, DEFAULT now())

### 6. assessment_responses
**Purpose**: Stores responses to assessment questions
**Columns**:
- id (uuid, NOT NULL, DEFAULT gen_random_uuid())
- attempt_id (uuid, NOT NULL) → REFERENCES assessment_attempts(id)
- question_id (uuid, NOT NULL)
- question_type (text, NOT NULL)
- selected_options (ARRAY)
- text_response (text)
- is_correct (boolean)
- points_awarded (numeric, DEFAULT 0)
- time_spent (integer)
- metadata (jsonb, DEFAULT '{}')
- created_at (timestamp with time zone, NOT NULL, DEFAULT now())
- updated_at (timestamp with time zone, NOT NULL, DEFAULT now())

### 7. assessment_sessions
**Purpose**: Manages assessment session state
**Columns**:
- id (uuid, NOT NULL, DEFAULT gen_random_uuid())
- quiz_id (uuid, NOT NULL) → REFERENCES quizzes(id)
- member_id (uuid, NOT NULL) → REFERENCES members(id)
- session_token (text, NOT NULL)
- started_at (timestamp with time zone, NOT NULL, DEFAULT now())
- last_activity (timestamp with time zone, NOT NULL, DEFAULT now())
- ended_at (timestamp with time zone)
- status (text, DEFAULT 'active')
- websocket_connection_id (text)
- metadata (jsonb, DEFAULT '{}')
- created_at (timestamp with time zone, NOT NULL, DEFAULT now())
- updated_at (timestamp with time zone, NOT NULL, DEFAULT now())

### 8. assessments
**Purpose**: Main assessment definitions
**Columns**:
- id (uuid, NOT NULL, DEFAULT gen_random_uuid())
- base_class_id (uuid)
- lesson_id (uuid)
- path_id (uuid)
- title (text, NOT NULL)
- description (text)
- assessment_type (USER-DEFINED, NOT NULL)
- settings (jsonb)
- created_at (timestamp with time zone, DEFAULT now())
- updated_at (timestamp with time zone, DEFAULT now())

### 9. dynamic_question_instances
**Purpose**: Handles dynamically generated question instances
**Columns**:
- id (uuid, NOT NULL, DEFAULT gen_random_uuid())
- dynamic_problem_id (uuid, NOT NULL) → REFERENCES dynamic_problems(id)
- question_id (uuid, NOT NULL) → REFERENCES questions(id)
- member_id (uuid, NOT NULL) → REFERENCES members(id)
- generated_parameters (jsonb, NOT NULL, DEFAULT '{}')
- generated_content (jsonb, NOT NULL, DEFAULT '{}')
- solution_data (jsonb, DEFAULT '{}')
- created_at (timestamp with time zone, NOT NULL, DEFAULT now())

### 10. lesson_question_options
**Purpose**: Options for lesson-specific questions
**Columns**:
- id (uuid, NOT NULL, DEFAULT gen_random_uuid())
- question_id (uuid, NOT NULL)
- option_text (text, NOT NULL)
- is_correct (boolean, NOT NULL, DEFAULT false)
- explanation (text)
- order_index (integer, DEFAULT 0)
- created_at (timestamp with time zone, NOT NULL, DEFAULT now())
- updated_at (timestamp with time zone, NOT NULL, DEFAULT now())

### 11. oral_exam_sessions
**Purpose**: Manages oral examination sessions
**Columns**:
- id (uuid, NOT NULL, DEFAULT gen_random_uuid())
- assessment_session_id (uuid, NOT NULL) → REFERENCES assessment_sessions(id)
- examiner_id (uuid) → REFERENCES members(id)
- ai_examiner_config (jsonb, DEFAULT '{}')
- transcript (text)
- audio_recording_url (text)
- video_recording_url (text)
- ai_analysis (jsonb, DEFAULT '{}')
- interaction_log (jsonb, DEFAULT '[]')
- duration_seconds (integer, DEFAULT 0)
- completed_at (timestamp with time zone)
- created_at (timestamp with time zone, NOT NULL, DEFAULT now())
- updated_at (timestamp with time zone, NOT NULL, DEFAULT now())

### 12. question_analytics
**Purpose**: Analytics data for individual questions
**Columns**:
- id (uuid, NOT NULL, DEFAULT gen_random_uuid())
- question_id (uuid, NOT NULL) → REFERENCES questions(id)
- total_responses (integer, DEFAULT 0)
- correct_responses (integer, DEFAULT 0)
- avg_time_spent (integer)
- difficulty_score (numeric)
- discrimination_index (numeric)
- common_wrong_answers (jsonb, DEFAULT '[]')
- last_calculated_at (timestamp with time zone, DEFAULT now())
- metadata (jsonb, DEFAULT '{}')
- created_at (timestamp with time zone, DEFAULT now())
- updated_at (timestamp with time zone, DEFAULT now())

### 13. question_folders
**Purpose**: Organizes questions into folders
**Columns**:
- id (uuid, NOT NULL, DEFAULT gen_random_uuid())
- name (text, NOT NULL)
- description (text)
- parent_id (uuid) → REFERENCES question_folders(id)
- color (text, DEFAULT '#3B82F6')
- base_class_id (uuid) → REFERENCES base_classes(id)
- created_by (uuid) → REFERENCES profiles(user_id)
- created_at (timestamp with time zone, NOT NULL, DEFAULT now())
- updated_at (timestamp with time zone, NOT NULL, DEFAULT now())

### 14. question_options
**Purpose**: Options for multiple choice questions
**Columns**:
- id (uuid, NOT NULL, DEFAULT gen_random_uuid())
- question_id (uuid, NOT NULL) → REFERENCES questions(id)
- option_text (text, NOT NULL)
- is_correct (boolean, NOT NULL)
- order_index (integer)
- created_at (timestamp with time zone, NOT NULL, DEFAULT now())
- updated_at (timestamp with time zone, NOT NULL, DEFAULT now())
- explanation (text)
- media_url (text)
- metadata (jsonb, DEFAULT '{}')

### 15. question_rubrics
**Purpose**: Links questions to rubrics
**Columns**:
- id (uuid, NOT NULL, DEFAULT gen_random_uuid())
- question_id (uuid, NOT NULL) → REFERENCES questions(id)
- rubric_id (uuid, NOT NULL) → REFERENCES rubrics(id)
- weight (real, DEFAULT 1.0)
- created_at (timestamp with time zone, NOT NULL, DEFAULT now())

### 16. questions
**Purpose**: Main question definitions (very complex table)
**Columns**:
- id (uuid, NOT NULL, DEFAULT gen_random_uuid())
- quiz_id (uuid) → REFERENCES quizzes(id)
- legacy_question_text (text)
- question_type (text, NOT NULL)
- points (integer, DEFAULT 1)
- order_index (integer)
- created_by (uuid) → REFERENCES profiles(user_id)
- created_at (timestamp with time zone, NOT NULL, DEFAULT now())
- updated_at (timestamp with time zone, NOT NULL, DEFAULT now())
- question_embedding (USER-DEFINED)
- difficulty_score (integer, DEFAULT 5)
- cognitive_level (text, DEFAULT 'understand')
- ai_generated (boolean, DEFAULT false)
- legacy_metadata (jsonb, DEFAULT '{}')
- validation_status (text, DEFAULT 'draft')
- tags (ARRAY, DEFAULT '{}')
- learning_objectives (ARRAY, DEFAULT '{}')
- estimated_time (integer, DEFAULT 2)
- lesson_content_refs (ARRAY, DEFAULT '{}')
- source_content (text)
- folder_id (uuid) → REFERENCES question_folders(id)
- lesson_id (uuid) → REFERENCES lessons(id)
- correct_answer (text)
- base_class_id (uuid) → REFERENCES base_classes(id)
- author_id (uuid) → REFERENCES profiles(user_id)
- options (jsonb)
- answer_key (jsonb)
- rubric (jsonb)
- question_text (text)

### 17. quiz_attempts
**Purpose**: Tracks quiz attempts
**Columns**:
- id (uuid, NOT NULL, DEFAULT gen_random_uuid())
- quiz_id (uuid, NOT NULL) → REFERENCES quizzes(id)
- member_id (uuid, NOT NULL) → REFERENCES members(id)
- started_at (timestamp with time zone, NOT NULL, DEFAULT now())
- completed_at (timestamp with time zone)
- score (integer)
- passed (boolean)
- created_at (timestamp with time zone, NOT NULL, DEFAULT now())
- updated_at (timestamp with time zone, NOT NULL, DEFAULT now())
- session_id (uuid)
- ip_address (inet)
- user_agent (text)
- time_spent_seconds (integer, DEFAULT 0)
- submission_metadata (jsonb, DEFAULT '{}')
- proctoring_data (jsonb, DEFAULT '{}')
- status (text, DEFAULT 'in_progress')

### 18. quiz_responses
**Purpose**: Individual responses to quiz questions
**Columns**:
- id (uuid, NOT NULL, DEFAULT gen_random_uuid())
- attempt_id (uuid, NOT NULL) → REFERENCES quiz_attempts(id)
- question_id (uuid, NOT NULL) → REFERENCES questions(id)
- selected_options (ARRAY)
- text_response (text)
- is_correct (boolean)
- points_awarded (integer)
- created_at (timestamp with time zone, NOT NULL, DEFAULT now())
- updated_at (timestamp with time zone, NOT NULL, DEFAULT now())
- response_embedding (USER-DEFINED)
- ai_feedback (jsonb, DEFAULT '{}')
- confidence_score (real)
- time_spent_seconds (integer, DEFAULT 0)
- interaction_data (jsonb, DEFAULT '{}')
- manual_grade (integer)
- grader_id (uuid) → REFERENCES members(id)
- graded_at (timestamp with time zone)
- feedback_text (text)

### 19. quizzes
**Purpose**: Main quiz definitions
**Columns**:
- id (uuid, NOT NULL, DEFAULT gen_random_uuid())
- lesson_id (uuid) → REFERENCES lessons(id)
- title (text, NOT NULL)
- description (text)
- time_limit (integer)
- pass_threshold (integer)
- shuffle_questions (boolean, DEFAULT false)
- created_by (uuid) → REFERENCES profiles(user_id)
- created_at (timestamp with time zone, NOT NULL, DEFAULT now())
- updated_at (timestamp with time zone, NOT NULL, DEFAULT now())
- assessment_type (text, DEFAULT 'quiz')
- settings (jsonb, DEFAULT '{}')
- proctoring_config (jsonb, DEFAULT '{}')
- ai_features (jsonb, DEFAULT '{}')
- max_attempts (integer, DEFAULT 1)
- randomize_options (boolean, DEFAULT false)
- show_feedback (boolean, DEFAULT true)
- feedback_timing (text, DEFAULT 'after_submission')
- auto_grade (boolean, DEFAULT true)
- path_id (uuid) → REFERENCES paths(id)

## Functions to be Removed (9 total)

### 1. archive_completed_assessments(days_old integer)
**Return Type**: integer
**Purpose**: Archives completed assessments older than specified days

### 2. calculate_assessment_completion(session_id uuid)
**Return Type**: integer
**Purpose**: Calculates completion percentage for an assessment session

### 3. create_assessment_with_questions(p_assessment_title text, p_assessment_type assessment_type, p_base_class_id uuid, p_lesson_id uuid, p_path_id uuid, p_questions jsonb)
**Return Type**: assessments
**Purpose**: Creates an assessment with associated questions in a single transaction

### 4. find_similar_questions(target_question_id uuid, similarity_threshold real, limit_count integer)
**Return Type**: record
**Purpose**: Finds similar questions using vector embeddings

### 5. get_assessment_summary(quiz_id uuid, member_id uuid)
**Return Type**: jsonb
**Purpose**: Returns assessment statistics for overall quiz or individual participant

### 6. get_base_class_from_quiz(quiz_id uuid)
**Return Type**: uuid
**Purpose**: Gets the base class ID from a quiz ID

### 7. get_base_class_questions(base_class_id_param uuid)
**Return Type**: record
**Purpose**: Returns all questions for a specific base class

### 8. get_question_analytics(question_id uuid)
**Return Type**: jsonb
**Purpose**: Returns analytics data for a specific question

### 9. validate_quiz_response(response_data jsonb)
**Return Type**: jsonb
**Purpose**: Validates and scores quiz responses

## Dependencies and Relationships

### External Table Dependencies
The assessment tables have foreign key relationships to these external tables that will remain:
- `base_classes`
- `lessons`
- `paths`
- `members`
- `profiles`
- `rubrics`
- `dynamic_problems`

### Internal Dependencies (within assessment system)
Complex web of relationships between assessment tables that require careful removal order:
1. `assessment_media` → `assessment_sessions`, `oral_exam_sessions`, `questions`
2. `oral_exam_sessions` → `assessment_sessions`
3. `assessment_sessions` → `quizzes`, `members`
4. `assessment_answers` → `assessment_attempts`, `questions`
5. `assessment_responses` → `assessment_attempts`
6. `quiz_responses` → `quiz_attempts`, `questions`
7. `quiz_attempts` → `quizzes`, `members`
8. `assessment_questions` → `assessments`, `questions`
9. `question_options` → `questions`
10. `question_rubrics` → `questions`, `rubrics`
11. `question_analytics` → `questions`
12. `questions` → `quizzes`, `question_folders`, `lessons`, `base_classes`, `profiles`
13. `question_folders` → `base_classes`, `profiles`, `question_folders` (self-reference)

## Removal Order Strategy
Based on dependencies, the removal should follow this order:
1. Functions (no dependencies)
2. Leaf tables (tables that other tables depend on):
   - `assessment_media`
   - `oral_exam_sessions`
   - `assessment_answers`
   - `assessment_responses`
   - `quiz_responses`
   - `question_options`
   - `question_rubrics`
   - `question_analytics`
   - `dynamic_question_instances`
   - `lesson_question_options`
3. Mid-level tables:
   - `assessment_sessions`
   - `assessment_attempts`
   - `quiz_attempts`
   - `assessment_questions`
   - `assessment_analytics`
4. Core tables:
   - `questions`
   - `question_folders`
   - `assessments`
   - `quizzes`

## Critical Data to Preserve
Before removal, consider if any of this data needs to be migrated:
- Student progress and scores from `assessment_attempts`, `quiz_attempts`
- Question content from `questions` table
- Assessment definitions from `assessments`, `quizzes`
- Question analytics data

## Notes
- The existing `questions` table is extremely complex with 25+ columns
- Multiple overlapping systems (assessments vs quizzes vs exams)
- Heavy use of JSONB for flexible data storage
- Vector embeddings for question similarity
- Complex analytics and media handling
- Proctoring and AI features built in

This complexity justifies the complete rebuild with a simplified 4-table approach. 