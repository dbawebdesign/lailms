-- Assessment Schema Removal Script
-- This script removes all 19 assessment-related tables and 9 functions
-- Tables are removed in dependency order to avoid foreign key constraint violations

-- ================================================================
-- STEP 1: Remove Functions (no dependencies)
-- ================================================================

DROP FUNCTION IF EXISTS archive_completed_assessments(integer);
DROP FUNCTION IF EXISTS calculate_assessment_completion(uuid);
DROP FUNCTION IF EXISTS create_assessment_with_questions(text, assessment_type, uuid, uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS find_similar_questions(uuid, real, integer);
DROP FUNCTION IF EXISTS get_assessment_summary(uuid, uuid);
DROP FUNCTION IF EXISTS get_base_class_from_quiz(uuid);
DROP FUNCTION IF EXISTS get_base_class_questions(uuid);
DROP FUNCTION IF EXISTS get_question_analytics(uuid);
DROP FUNCTION IF EXISTS validate_quiz_response(jsonb);

-- ================================================================
-- STEP 2: Remove Leaf Tables (tables that other tables depend on)
-- ================================================================

-- Remove media and session-related tables
DROP TABLE IF EXISTS assessment_media CASCADE;
DROP TABLE IF EXISTS oral_exam_sessions CASCADE;

-- Remove answer and response tables
DROP TABLE IF EXISTS assessment_answers CASCADE;
DROP TABLE IF EXISTS assessment_responses CASCADE;
DROP TABLE IF EXISTS quiz_responses CASCADE;

-- Remove question-related leaf tables
DROP TABLE IF EXISTS lesson_question_options CASCADE;
DROP TABLE IF EXISTS question_options CASCADE;
DROP TABLE IF EXISTS question_rubrics CASCADE;
DROP TABLE IF EXISTS question_analytics CASCADE;

-- Remove dynamic question instances
DROP TABLE IF EXISTS dynamic_question_instances CASCADE;

-- ================================================================
-- STEP 3: Remove Mid-Level Tables
-- ================================================================

-- Remove session and attempt tables
DROP TABLE IF EXISTS assessment_sessions CASCADE;
DROP TABLE IF EXISTS assessment_attempts CASCADE;
DROP TABLE IF EXISTS quiz_attempts CASCADE;

-- Remove linking tables
DROP TABLE IF EXISTS assessment_questions CASCADE;

-- Remove analytics tables
DROP TABLE IF EXISTS assessment_analytics CASCADE;

-- ================================================================
-- STEP 4: Remove Core Tables
-- ================================================================

-- Remove the main questions table (most complex)
DROP TABLE IF EXISTS questions CASCADE;

-- Remove question organization
DROP TABLE IF EXISTS question_folders CASCADE;

-- Remove assessment and quiz definitions
DROP TABLE IF EXISTS assessments CASCADE;
DROP TABLE IF EXISTS quizzes CASCADE;

-- ================================================================
-- STEP 5: Clean up any remaining assessment-related types/enums
-- ================================================================

-- Remove custom types if they exist and are only used by assessment system
-- Note: We'll check if these are used elsewhere before removing
-- DROP TYPE IF EXISTS assessment_type CASCADE;
-- DROP TYPE IF EXISTS question_type CASCADE;

-- ================================================================
-- VERIFICATION QUERIES
-- ================================================================

-- Uncomment these to verify removal was successful:

-- Check remaining assessment-related tables
-- SELECT table_name 
-- FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND (table_name LIKE '%assess%' 
--      OR table_name LIKE '%quiz%' 
--      OR table_name LIKE '%exam%' 
--      OR table_name LIKE '%question%')
-- ORDER BY table_name;

-- Check remaining assessment-related functions
-- SELECT routine_name
-- FROM information_schema.routines 
-- WHERE routine_schema = 'public' 
-- AND (routine_name LIKE '%assess%' 
--      OR routine_name LIKE '%quiz%' 
--      OR routine_name LIKE '%exam%' 
--      OR routine_name LIKE '%question%')
-- ORDER BY routine_name;

-- ================================================================
-- NOTES
-- ================================================================

-- 1. This script uses CASCADE to handle any remaining dependencies
-- 2. All tables are removed with IF EXISTS to prevent errors if already removed
-- 3. The order is carefully planned to minimize constraint violations
-- 4. Custom types are commented out - check if used elsewhere before removing
-- 5. Verification queries are provided but commented out
-- 6. This operation is IRREVERSIBLE - ensure backups are available

-- ================================================================
-- EXECUTION LOG
-- ================================================================

-- Uncomment to log the removal:
-- SELECT 'Assessment schema removal completed at: ' || NOW(); 