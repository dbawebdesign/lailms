# Current Supabase Schema - Updated for Role Switching Support

This document tracks the current state of our Supabase database schema, including all recent updates to support role switching functionality.

## Recent Updates and Fixes

### Survey Feature Implementation (January 2025)

**Feature**: Added comprehensive survey system for new homeschool users with 4-section, 23-question survey for product validation and demographics.

**Tables Added**:

1. **survey_sections** - Survey section metadata
   - `id` (serial, primary key)
   - `title` (text, not null) - Section title
   - `description` (text) - Optional section description
   - `order_index` (integer, not null) - Display order
   - `created_at`, `updated_at` (timestamps)

2. **survey_questions** - Individual survey questions
   - `id` (serial, primary key)
   - `section_id` (integer, foreign key to survey_sections)
   - `question_text` (text, not null) - The question content
   - `question_type` (text, not null) - Type: 'likert', 'multiple_choice', 'text', 'numerical', 'scale'
   - `options` (jsonb) - Question-specific options and configuration
   - `required` (boolean, default true)
   - `order_index` (integer, not null) - Order within section
   - `created_at`, `updated_at` (timestamps)

3. **survey_responses** - User completion records
   - `id` (serial, primary key)
   - `user_id` (uuid, foreign key to profiles.user_id, unique)
   - `completed_at` (timestamp) - When survey was completed
   - `duration_seconds` (integer) - Time spent on survey
   - `device_info` (jsonb) - Device and browser information
   - `created_at`, `updated_at` (timestamps)

4. **survey_question_responses** - Individual question answers
   - `id` (serial, primary key)
   - `survey_response_id` (integer, foreign key to survey_responses)
   - `question_id` (integer, foreign key to survey_questions)
   - `response_value` (text) - The selected/entered value
   - `response_text` (text) - Additional text for open-ended responses
   - `created_at`, `updated_at` (timestamps)

**Schema Updates**:
- Added `survey_completed` (boolean, default false) to `profiles` table
- Added Row Level Security (RLS) policies for all survey tables
- Users can only access their own survey responses
- Admin users can view all responses for analytics

**Admin Analytics Access**:
- Survey analytics dashboard (`/dev-admin/survey-analytics`) uses admin API routes
- API routes use service role key to bypass RLS and access ALL survey responses
- This ensures complete dataset for analytics regardless of current user's role
- Routes: `/api/dev-admin/survey-analytics` and `/api/survey/analytics-chat`

**Survey Content**:
- **Section 1**: Problem Validation (7 Likert scale questions about curriculum challenges)
- **Section 2**: Product Test (7 importance scale questions about AI features)
- **Section 3**: Primary Concerns (1 multiple choice about AI adoption concerns)
- **Section 4**: Demographics (7 mixed questions including pricing, education, approaches)

**Files Added**:
- Migration: `20250103000000_create_survey_system.sql`
- Components: Survey modal, sections, and question type components
- API: `/api/survey/submit` route for handling submissions
- Types: Survey-related TypeScript interfaces
- Hook: `useSurvey.ts` for data management

### HomeschoolDashboard Active Courses Fix (December 2024)

**Issue**: The HomeschoolDashboard was showing 0 active courses for teachers who had active class instances.

**Root Cause**: 
1. The active courses count was hardcoded to 0 instead of fetching real data from Supabase
2. The component was not querying the `class_instances` table to get actual active courses
3. The query structure needed to properly join with `base_classes` table since `organisation_id` is stored there

**Fixes Applied**:

1. **Added Active Courses State**: Added `activeCourses` state to track the actual count
2. **Enhanced Data Fetching**: Modified `fetchDashboardData` to:
   - Get current authenticated user ID
   - Query `class_instances` joined with `base_classes` to get active courses
   - Filter by teacher's user ID, active status, and organization ID
   - Properly handle the relationship where `organisation_id` is on `base_classes` table

3. **Fixed Query Structure**:
   ```sql
   SELECT ci.id, ci.name, ci.status, bc.user_id, bc.organisation_id
   FROM class_instances ci
   JOIN base_classes bc ON ci.base_class_id = bc.id
   WHERE bc.user_id = 'current_user_id'
     AND ci.status = 'active'
     AND bc.organisation_id = 'organization_id'
   ```

4. **Added Error Handling**: Added proper error handling and logging for debugging
5. **Fixed Column Naming**: Corrected `organization_id` to `organisation_id` in invite codes query

**Files Modified**:
- `src/components/dashboard/HomeschoolDashboard.tsx` - Added active courses fetching and state management

**Result**: The HomeschoolDashboard now displays the accurate count of active courses for teachers, providing real-time data from the Supabase database.

### Gradebook Header Cleanup and Analytics Fixes (December 2024)

**Issue**: The gradebook header was showing a "Live Data" indicator that was no longer needed since all data is now live. Additionally, the analytics dashboard was showing 0% for class average and completion rate despite having real data.

**Root Cause**: 
1. The "Live Data" indicator was redundant since all gradebook data is now live by default
2. The analytics calculations were using an incorrect key format for accessing grades data
3. The calculations were using raw points instead of percentages, leading to incorrect averages

**Fixes Applied**:

1. **Removed "Live Data" Indicator**:
   - Removed the green "Live Data" card from the gradebook header in `GradebookShell.tsx`
   - Kept the sync status badge and refresh button for actual status monitoring

2. **Fixed Analytics Calculations**:
   - **Key Format Fix**: Changed from `${student.id}_${assignment.id}` to `${student.id}-${assignment.id}` to match the format used in `useGradebook.ts`
   - **Class Average Fix**: Now uses the pre-calculated `overall_grade` from students instead of recalculating from raw points
   - **Completion Rate Fix**: Now properly filters out missing assignments and uses correct key format
   - **Assignment Types Fix**: Now calculates percentages correctly for each assignment type
   - **Grade Distribution Fix**: Uses the already calculated student overall grades for accurate distribution
   - **At-Risk/Excelling Students Fix**: Now uses overall grades instead of raw point calculations

3. **Improved Calculation Logic**:
   - Added proper null checks and filtering for missing/incomplete grades
   - Added percentage calculations for assignment types instead of raw points
   - Added proper rounding for display values

**Files Modified**:
- `src/components/teach/gradebook/GradebookShell.tsx` - Removed "Live Data" indicator
- `src/components/teach/gradebook/analytics/AnalyticsDashboard.tsx` - Fixed all analytics calculations

**Result**: The gradebook header is now cleaner and the analytics dashboard properly displays:
- Correct class average based on actual student grades
- Accurate completion rate reflecting actual submissions
- Proper grade distribution showing real percentages
- Correct at-risk and excelling student counts

All analytics now reflect the actual data in the gradebook, providing teachers with accurate insights into class performance.

### Student Details Panel Grade Display Fix (December 2024)

**Issue**: The Student Details Panel was showing "Missing" badges for assignments that students had actually completed and received grades for (e.g., showing "Missing" for an assignment where the student scored 80%).

**Root Cause**: The StudentDetailsPanel component was using an incorrect key format to access grade data from the grades record, causing it to not find existing grades.

**Fixes Applied**:

1. **Fixed Grade Key Format**:
   - Changed from `${studentId}_${assignment.id}` to `${studentId}-${assignment.id}` to match the format used in `useGradebook.ts`
   - This ensures the component can properly access existing grade data

2. **Improved Grade Status Logic**:
   - Enhanced the status determination logic to properly handle different grade states
   - Added checks for `grade.status === 'graded'` and `grade.points_earned !== null`
   - Added proper handling for 'late', 'excused', and 'missing' statuses

3. **Enhanced UI Display**:
   - Added proper badge styling for different grade statuses
   - Added "Late" badge with warning styling for late submissions
   - Added "Excused" badge with muted styling for excused assignments
   - Maintained "Missing" badge for truly missing assignments

**Files Modified**:
- `src/components/teach/gradebook/details/StudentDetailsPanel.tsx` - Fixed grade key format and improved status logic

**Result**: The Student Details Panel now correctly displays:
- Actual grades and percentages for completed assignments
- Appropriate status badges (Late, Excused, Missing) based on actual grade data
- Proper color coding for different grade ranges
- Accurate reflection of student performance data

### Assignment Type NaN Display Fix (December 2024)

**Issue**: The analytics dashboard was showing "NaN%" for assignment type averages (exam, quiz, etc.) even when there were assignments of those types in the gradebook.

**Root Cause**: The assignment types calculation was encountering division by zero or invalid numbers when:
1. Assignment types had no graded submissions (all missing or ungraded)
2. Calculations resulted in NaN values that weren't being handled properly
3. The UI didn't have fallback handling for empty assignment type data

**Fixes Applied**:

1. **Enhanced Assignment Types Calculation**:
   - Added check to skip assignments with no valid grades (`assignmentGrades.length === 0`)
   - Added validation to ensure calculated averages are valid numbers (`isNaN(average) || !isFinite(average)`)
   - Added final safety check when returning assignment types data to convert NaN to 0

2. **Improved UI Handling**:
   - Added fallback message when no assignment types have graded submissions
   - Added proper empty state display with helpful message about when data will appear
   - Added BookOpen icon import for the empty state

3. **Defensive Programming**:
   - Added multiple layers of NaN protection in the calculation pipeline
   - Ensured all numeric operations have proper fallbacks
   - Added validation at both calculation and display levels

**Files Modified**:
- `src/components/teach/gradebook/analytics/AnalyticsDashboard.tsx` - Fixed calculation logic and added empty state handling

**Result**: The analytics dashboard now properly displays:
- Valid percentage values for assignment types with graded submissions
- "0%" instead of "NaN%" for edge cases
- Helpful empty state message when no assignment types have been graded yet
- Robust handling of various data states without displaying invalid numbers

### Assignment Progress Calculation Fix (December 2024)

**Issue**: The Students Overview was showing "0/0" for assignment progress even when students had completed assignments and there were 40+ assignments in the gradebook.

**Root Cause**: The `useGradebook` hook was not calculating and providing the `completed_assignments` and `total_assignments` fields that the `StudentsOverview` component expected.

**Fixes Applied**:

1. **Updated GradebookData Interface**:
   - Added `completed_assignments: number` and `total_assignments: number` to the student data structure in `useGradebook.ts`

2. **Enhanced Grade Statistics Calculation**:
   - Modified `calculateGradeStatistics()` function to calculate completed assignments (status === 'graded')
   - Added total assignments count (total number of assignments in the class)
   - Updated the default values for students with no grades

3. **Fixed Data Transformation**:
   - Updated `GradebookShell.tsx` to include the new fields in the `transformedData` mapping
   - Ensured all components receive the complete student data structure

**Files Modified**:
- `src/hooks/useGradebook.ts` - Added completed_assignments and total_assignments calculations
- `src/components/teach/gradebook/GradebookShell.tsx` - Updated data transformation to include new fields

**Result**: The Students Overview now correctly displays assignment progress (e.g., "1/40" for a student who has completed 1 out of 40 assignments), providing accurate tracking of student completion rates.

## Recent Assessment Grading Fixes

### True/False Question Grading Issue Resolution
**Issue**: True/False questions were being marked as incorrect even when the student selected the correct answer.

**Root Cause**: Type comparison issues in the grading logic where boolean values were not being properly normalized before comparison.

**Fix Applied**: 
- Updated `InstantGradingService.gradeTrueFalse()` to properly normalize both student answers and correct answers to boolean types
- Added type conversion for string inputs (`'true'` → `true`, `'false'` → `false`)
- Enhanced debugging logs to track type conversion issues
- Fixed syntax error in `src/app/api/learn/assessments/submit/route.ts` where True/False grading logic was missing proper condition structure

### Matching Question UI Improvement
**Issue**: Correct matches were showing red borders when the overall assessment was correct, causing user confusion.

**Fix Applied**:
- Updated `NewSchemaQuestionMatching.tsx` to only show red styling for incorrect matches when the overall assessment is incorrect
- Modified `isIncorrectMatch` logic to include `!instantFeedback.isCorrect` condition
- Now shows green styling for correct matches when assessment is correct, no red styling when all matches are perfect

### Current Score NaN Display Issue Resolution
**Issue**: The current score in the assessment interface was showing "NaN%" instead of a proper percentage.

**Root Cause**: The score calculation logic was not handling edge cases where division by zero or invalid numbers could result in NaN values.

**Fix Applied**:
- Updated `InstantGradingService.calculateTotalScore()` to validate all numeric inputs and outputs
- Added defensive programming to handle NaN values in feedback points and max points
- Enhanced `updateCurrentScore()` function to validate all calculated values before setting state
- Added NaN checks in display components to show "0.0%" instead of "NaN%"
- Fixed both new and legacy assessment taker components to handle NaN values gracefully

### Gradebook Settings Save Functionality
**Issue**: The GradebookSettings component had a TODO comment indicating save functionality wasn't implemented.

**Root Cause**: The handleSaveSettings function was only logging to console instead of actually saving settings to the database.

**Fix Applied**:
- Updated GradebookSettings component to accept `onUpdateSettings` prop from useGradebook hook
- Modified GradebookShell to pass the `updateSettings` function to GradebookSettings
- Implemented proper save functionality that calls the useGradebook hook's updateSettings method
- Added initialization of settings from live data instead of hardcoded defaults
- Added useEffect to update settings when data changes from the database

**Result**: Gradebook settings can now be properly saved to the database and persist across sessions.

## Profile System with Role Switching

### Core Role Fields
- `role` (enum): Primary user role assigned during signup
- `active_role` (enum): Currently active role for role switching (nullable)
- `additional_roles` (text[]): Array of roles user can switch between

### Effective Role Calculation
All application logic and RLS policies now use: `COALESCE(active_role, role)` as the effective role.

### Role Switching Trigger
```sql
-- Trigger ensures active_role can only be set to roles in additional_roles array
CREATE OR REPLACE FUNCTION check_active_role_allowed()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow setting active_role to null (revert to primary role)
  IF NEW.active_role IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check if active_role is in additional_roles array
  IF NEW.active_role = ANY(NEW.additional_roles) THEN
    RETURN NEW;
  END IF;
  
  -- Reject if active_role not in additional_roles
  RAISE EXCEPTION 'Active role % is not in additional_roles array', NEW.active_role;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_active_role 
  BEFORE UPDATE ON profiles 
  FOR EACH ROW 
  EXECUTE FUNCTION check_active_role_allowed();
```

## Updated RLS Policies (Migration: update_rls_policies_for_role_switching)

All RLS policies have been updated to use the effective role pattern. Key updates include:

### Admin/Super Admin Policies
- `agent_performance_summary`: Admin viewing rights
- `feedback_support`: Admin management and viewing
- `homeschool_family_info`: Admin management within organization
- `invite_codes`: Organization admin management

### Teacher Policies
- `paths`: Creator and organization teacher/admin access
- `standards`: Teacher management within organization
- `lessons`: Complex multi-role access patterns

### Effective Role Pattern
All policies now use:
```sql
COALESCE(profiles.active_role, profiles.role) = 'target_role'::role
-- or for multiple roles:
COALESCE(profiles.active_role, profiles.role) = ANY (ARRAY['role1'::role, 'role2'::role])
```

## Application Layer Updates

### Centralized Role Checking
- `lib/utils/roleUtils.ts`: All role checking functions updated
- `isTeacher()`, `isAdmin()`, `isSuperAdmin()`, `hasTeacherPermissions()`
- `getEffectiveRole()`: Returns `active_role || role`

### Database Query Pattern
All database queries use:
```sql
SELECT id, email, full_name, role, active_role, additional_roles,
       COALESCE(active_role, role) as effective_role
FROM profiles 
WHERE user_id = $1;
```

### API Endpoints
All API routes updated to use centralized role checking functions instead of hardcoded `profile.role` checks.

## Role Switching UI Components

### Role Switching Hook
```typescript
// hooks/useRoleSwitch.ts
const useRoleSwitch = () => {
  const switchRole = async (newRole: UserRole | null) => {
    // Updates active_role field and refreshes page
  };
  return { switchRole, availableRoles, currentRole };
};
```

### Navigation Updates
- Header component shows role switcher for users with multiple roles
- Navigation items respect effective role permissions
- Full page refresh on role switch to update server-side layouts

## Security Considerations

### RLS Policy Coverage
✅ All policies updated to respect role switching
✅ No hardcoded role checks remain in database layer
✅ Effective role pattern consistently applied

### Application Layer Coverage  
✅ All API endpoints use centralized role checking
✅ All page components use role utility functions
✅ All database queries use effective role pattern

### Type Safety
✅ Consistent `UserRole` and `UserProfile` type exports
✅ No import conflicts between role definitions

## Testing Verification

The role switching system has been verified to work across:
- Database RLS policies (all updated)
- API endpoint permissions (all use centralized functions)
- UI component access control (all use role utilities)
- Navigation and routing (respects effective role)

## Future Maintenance

When adding new features:
1. **RLS Policies**: Use `COALESCE(profiles.active_role, profiles.role)` pattern
2. **API Endpoints**: Use functions from `lib/utils/roleUtils.ts`
3. **UI Components**: Use centralized role checking hooks/utilities
4. **Database Queries**: Include effective role calculation in SELECT statements

This ensures role switching continues to work seamlessly across all parts of the application.

## Gradebook Automation System

The system includes comprehensive automatic gradebook integration implemented via database triggers and functions:

### Automatic Assignment Creation
When class instances are created, assignments are automatically generated from published assessments:
- **Assignment Naming**: Uses only the assessment title (not prefixed with lesson/path titles)
- **Assignment Type Mapping**: lesson → quiz, path → exam, class → exam
- **Points**: Calculated from assessment questions or defaults to 100
- **Categories**: "Lesson Assessments", "Path Quizzes", "Class Exams"

### Automatic Grade Sync
When students complete assessments, grades are automatically synced to the gradebook:
- **Trigger**: `sync_grade_on_assessment_completion` on `student_attempts` table
- **Condition**: Fires when `status` changes to 'completed'
- **Score Mapping**: `total_points_earned` → `points_earned`, `percentage_score` → `percentage`
- **Status**: Automatically set to 'graded' with completion timestamp

### Student Enrollment Integration
When students join classes, grade records are automatically created for all existing assignments:
- **Trigger**: `create_grades_on_student_enrollment` on `rosters` table
- **Initial Status**: 'pending' for all assignments
- **Retroactive**: Creates grades for all published assignments in the class

### Key Database Functions
- `populate_assignments_from_assessments(class_instance_id)`: Creates gradebook assignments from assessments
- `sync_grade_from_assessment_attempt(attempt_id)`: Syncs assessment scores to gradebook
- `create_grades_for_new_student(class_instance_id, student_id)`: Creates grade records for new students

### Database Triggers
- `populate_assignments_on_class_creation`: After INSERT on `class_instances`
- `sync_grade_on_assessment_completion`: After UPDATE on `student_attempts`
- `create_grades_on_student_enrollment`: After INSERT on `rosters`
- `populate_assignments_on_assessment_creation`: After INSERT/UPDATE on `assessments`

This automation ensures seamless integration between the assessment system and gradebook without manual intervention.

## Document Processing System

### Text Sanitization
All document processing functions now include Unicode sanitization to prevent database insertion errors:
- **Null Character Removal**: Removes `\u0000` characters that cause PostgreSQL errors
- **Control Character Cleanup**: Removes problematic Unicode sequences `\u0001-\u0008`, `\u000B`, `\u000C`, `\u000E-\u001F`, `\u007F`
- **Replacement Character Removal**: Removes `\uFFFD` replacement characters
- **Line Ending Normalization**: Converts `\r\n` and `\r` to `\n`

### Affected Functions
- `process-document`: PDF, URL, YouTube, and audio text extraction
- `kb-process-textfile`: Plain text file processing
- Both functions apply `sanitizeTextForDatabase()` before database insertion

### Error Prevention
The sanitization fixes the PostgreSQL error: `"unsupported Unicode escape sequence"` when processing documents with null characters or other problematic Unicode sequences commonly found in PDFs and web content.

## Gradebook Mock Data Elimination - SYSTEMATIC REVIEW COMPLETED

**Issue**: Multiple gradebook components were using mock/hardcoded data instead of live data from Supabase.

**Components Fixed**:

1. **StudentDetailsPanel** - FIXED
   - Replaced hardcoded mock student data with actual student data from props
   - Fixed grade history to use real assignment and grade data from database
   - Updated feedback display to show actual teacher feedback from grades
   - Replaced mock standards progress with real standards data
   - All student information now pulls from live Supabase data

2. **BulkFeedbackDrawer** - FIXED
   - Replaced mock students array with real student data from props
   - Updated assignments dropdown to use real assignment data from database
   - Modified component interface to accept data prop for live data access
   - Updated GradebookShell to pass live data to BulkFeedbackDrawer

3. **ExportDialog** - FIXED
   - Replaced mock export functionality with real data export
   - Implemented actual file download for JSON and CSV formats
   - Export now includes real student data, grades, assignments, and analytics
   - Added proper error handling and user feedback for export operations

4. **All Other Components** - VERIFIED LIVE DATA
   - GradebookGrid: Uses live data from useGradebook hook ✅
   - StudentsOverview: Uses live data from props ✅
   - AnalyticsDashboard: Calculates real analytics from live data ✅
   - AssignmentsManager: Uses live data from props ✅
   - StandardsTracker: Uses live data from props ✅
   - GradebookSettings: Uses live data with proper save functionality ✅

**Result**: All 6 gradebook tabs and their components now use live data from Supabase with no remaining mock data. The gradebook system is fully functional with real-time data integration. 

### Class Instances Enrollment Data Fixes (December 2024)

**Issue**: The class instances page was showing "0 / ∞" for student enrollment even when students were enrolled and capacity limits were set. The individual instance page was also not showing accurate enrollment counts.

**Root Cause**: 
1. The `/api/teach/instances` endpoint was not fetching or calculating the `student_count` field that the `EnrichedClassInstance` type expected
2. The `AllInstancesTable` component was hardcoded to show "0 / ∞" instead of using actual data
3. The individual instance page was trying to count students from a join that wasn't working properly

**Fixes Applied**:

1. **Updated API Endpoint** (`src/app/api/teach/instances/route.ts`):
   - Added proper student count calculation by querying the `rosters` table for each instance
   - Added `student_count` and `instructor_count` fields to the returned data
   - Used `count: 'exact'` to get accurate enrollment numbers

2. **Fixed AllInstancesTable Component** (`src/components/teach/AllInstancesTable.tsx`):
   - Updated enrollment display to use `instance.student_count` instead of hardcoded "0"
   - Added proper capacity display from `instance.settings.capacity`
   - Fixed sorting logic for the `enrolledStudents` column to use `student_count`
   - Added TypeScript casting for settings access

3. **Fixed Individual Instance Page** (`src/app/(app)/teach/instances/[instanceId]/page.tsx`):
   - Updated `getClassInstanceData` function to properly count enrolled students from rosters table
   - Removed ineffective rosters join from the main query
   - Added separate count query for accurate enrollment numbers

**Result**: 
- Class instances page now shows correct enrollment counts (e.g., "1 / 25" instead of "0 / ∞")
- Individual instance pages display accurate student counts
- Capacity limits are properly displayed when set
- All enrollment data is fetched from live Supabase data 

### Comprehensive Class Instance Data Review and Fixes (December 2024)

**Issue**: Comprehensive review revealed multiple issues with class instance data accuracy, functionality, and user experience inconsistencies.

**Problems Found**:
1. **Incorrect User ID Mapping**: `getClassStats` function was using roster IDs instead of user IDs for quiz attempts queries
2. **Missing Email Addresses**: Student performance was showing user IDs instead of actual email addresses
3. **Inaccurate Quiz Count**: Quiz/assessment counts were hardcoded to 0 instead of being calculated from actual data
4. **Inappropriate Student Management**: UI showed "Add Student" buttons when students should enroll themselves with codes
5. **Data Inconsistencies**: Various calculations were using simplified or incorrect data mappings

**Comprehensive Fixes Applied**:

1. **Fixed User ID Mapping** (`getClassStats` function):
   - Changed roster query to include `profiles!inner(user_id)` to get actual user IDs
   - Fixed quiz attempts queries to use proper user IDs from profiles instead of roster IDs
   - Corrected active students count and progress calculations

2. **Enhanced Student Performance Data** (`getStudentPerformance` function):
   - Added proper email field retrieval from profiles table
   - Fixed student email display to show actual email addresses instead of user IDs
   - Improved data accuracy for student performance metrics

3. **Implemented Real Quiz/Assessment Counting** (`getClassInstanceData` function):
   - Added proper quiz count calculation from `lesson_assessments` table
   - Linked assessments to lessons within the class's learning paths
   - Replaced hardcoded "0" with actual assessment counts

4. **Removed Inappropriate Student Management Features**:
   - Removed all "Add Student" buttons from class instance pages
   - Replaced with enrollment code display emphasizing self-enrollment
   - Updated UI text to reflect that students enroll themselves with codes
   - Removed unused imports (Plus, UserPlus icons)

5. **UI/UX Improvements**:
   - Added enrollment code display in student management section
   - Updated student management description to "Monitor your enrolled students"
   - Replaced student action buttons with enrollment code sharing
   - Improved icon usage for student_joined activities

6. **Data Accuracy Enhancements**:
   - Fixed all database queries to use proper foreign key relationships
   - Ensured consistent data mapping between roster entries and user profiles
   - Improved error handling for data retrieval operations

**Result**: 
- All class instance data now uses live, accurate Supabase data
- Student enrollment properly reflects the self-enrollment model
- Quiz and assessment counts are calculated from actual database content
- Student performance metrics use correct user identification
- UI reflects the proper enrollment workflow (codes, not teacher-added students)
- All tabs and components show consistent, accurate data
- System properly handles the relationship between rosters, profiles, and quiz attempts

### Class Instance Student Email Access Fix (December 2024)

**Issue**: The `getStudentPerformance` function was trying to use `supabase.auth.admin.listUsers()` to get student email addresses, but this requires admin privileges and was causing `AuthApiError: User not allowed` errors.

**Root Cause**: The function was attempting to access the `auth.users` table directly through the admin API, which is not allowed for regular users due to security restrictions.

**Solution**: 
1. **Created New RPC Function**: Added `get_class_instance_student_data(p_class_instance_id uuid)` function that uses `SECURITY DEFINER` to properly join `rosters`, `profiles`, and `auth.users` tables
2. **Updated Function Logic**: Modified `getStudentPerformance` to use the new RPC function instead of admin API calls
3. **Fixed Data Structure**: Updated all references from `roster.profiles.user_id` to `student.id` and `student.email` to match the new data structure

**Files Modified**:
- Added migration: `create_get_class_instance_student_data_function.sql`
- Updated: `src/app/(app)/teach/instances/[instanceId]/page.tsx` - Fixed `getStudentPerformance` function

**Technical Details**:
- The new RPC function properly joins `public.rosters`, `public.profiles`, and `auth.users` tables
- Uses `SECURITY DEFINER` to bypass RLS restrictions for the complex join
- Returns JSON with student data including actual email addresses from `auth.users.email`
- Eliminates the need for admin API access while maintaining security

**Result**: Student performance data now properly displays actual email addresses without authentication errors.

### Class Instance Page Complete Live Data Review (December 2024)

**Issue**: User requested comprehensive review of all tabs and data on the class instance page to ensure no hardcoded or mock data was being used.

**Review Results**: 

**✅ Already Using Live Data:**
1. **Header Stats Cards** - All using live data from database:
   - Total Students: From `rosters` table count
   - Avg Progress: Calculated from `quiz_attempts` table
   - Active Today: From `quiz_attempts` filtered by today's date
   - Pending Reviews: Calculated from assignments and submissions

2. **Overview Tab** - All using live data:
   - Class Information: From `class_instances` and `base_classes` tables
   - Learning Paths: From `paths` table count
   - Lessons: From `lessons` table count  
   - Assessments: From `lesson_assessments` table count
   - Recent Activity: From `quiz_attempts` and `rosters` tables

3. **Students Tab** - All using live data:
   - Student names, emails: From `profiles` and `auth.users` tables via RPC
   - Progress percentages: Calculated from `quiz_attempts` data
   - Quiz averages: Calculated from actual quiz submission data
   - Status: Dynamically calculated from activity patterns

4. **Activity Tab** - All using live data:
   - Quiz submissions: From `quiz_attempts` table
   - Student enrollments: From `rosters` table
   - All timestamps and descriptions from actual database records

**⚠️ Issues Fixed:**
1. **Progress Tab**: Replaced placeholder "coming soon" message with actual live data visualizations:
   - Class performance metrics with real averages
   - Student status breakdown (active/falling behind)
   - Activity summary with real counts
   - Individual student progress cards with actual data

**Files Modified**:
- Updated: `src/app/(app)/teach/instances/[instanceId]/page.tsx` - Enhanced Progress tab with live data

**Result**: All four tabs (Overview, Students, Progress, Activity) now display 100% live data from Supabase with no hardcoded or mock values. The Progress tab now shows meaningful analytics calculated from actual student performance data. 

## Survey System Implementation (December 2024)

### New Survey Feature for Homeschool Users

**Purpose**: Mandatory onboarding survey for new homeschool users to collect product validation data and demographic information for product development guidance.

**Implementation Details**:

1. **Survey Modal System**: Modal that appears on first login for homeschool users
2. **Mandatory Completion**: Users cannot access the app until survey is completed
3. **Data Collection**: 4-section survey with 22 questions total covering:
   - Problem validation (7 Likert scale questions)
   - Product feature importance (7 importance scale questions)
   - Primary concerns (1 multiple choice question)
   - Demographics (7 mixed-format questions)

4. **Admin Analytics**: Comprehensive dashboard in dev-admin for data analysis and insights

### Database Schema Changes

**New Tables Added**:

```sql
-- Survey system tables
CREATE TABLE survey_sections (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE survey_questions (
    id SERIAL PRIMARY KEY,
    section_id INTEGER REFERENCES survey_sections(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) NOT NULL CHECK (question_type IN ('likert', 'multiple_choice', 'numerical', 'scale', 'text')),
    options JSONB, -- Store options for multiple choice, scale definitions, etc.
    required BOOLEAN DEFAULT true,
    order_index INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE survey_responses (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    duration_seconds INTEGER,
    device_info JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id) -- Each user can only complete the survey once
);

CREATE TABLE survey_question_responses (
    id SERIAL PRIMARY KEY,
    survey_response_id INTEGER REFERENCES survey_responses(id) ON DELETE CASCADE,
    question_id INTEGER REFERENCES survey_questions(id) ON DELETE CASCADE,
    response_value TEXT, -- Store the actual response value
    response_text TEXT, -- For text responses or additional comments
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(survey_response_id, question_id) -- One response per question per survey
);
```

**Profile Table Updates**:
```sql
-- Added survey completion tracking
ALTER TABLE profiles ADD COLUMN survey_completed BOOLEAN DEFAULT false;
```

**RLS Policies**:
- Users can only view/modify their own survey responses
- Authenticated users can read survey questions and sections
- Admin users can view all survey responses for analytics

**Indexes Added**:
- `idx_survey_questions_section_order` - For efficient question ordering
- `idx_survey_responses_user_id` - For user lookup optimization
- `idx_survey_question_responses_survey_id` - For response querying
- `idx_profiles_survey_completed` - For survey completion status queries

### Survey Question Types Supported

1. **Likert Scale**: 5-point agreement scales (Strongly Disagree → Strongly Agree)
2. **Importance Scale**: 5-point importance scales (Very Unimportant → Very Important)
3. **Multiple Choice**: Single or multiple selection options
4. **Numerical**: Currency inputs for pricing questions
5. **Scale**: 1-10 rating scales with custom labels

### Survey Sections

1. **Problem Validation** (7 questions)
   - Curriculum sourcing challenges
   - Time spent on lesson planning
   - Personalization gaps in current tools
   - Fragmentation of education tools
   - Progress tracking difficulties
   - Curriculum control preferences
   - Homeschool burnout experiences

2. **Product Test** (7 questions)
   - Feature importance ratings for LearnologyAI capabilities
   - AI curriculum generator
   - Source control during generation
   - Learning style adaptation
   - AI student tutor
   - AI teacher tools
   - Integrated gradebook
   - End-to-end LMS functionality

3. **Primary Concerns** (1 question)
   - Main worry about adopting AI-powered learning platform
   - Privacy/security, cost, complexity, dependency, integration, personal touch

4. **Demographics** (7 questions)
   - Homeschooling approach preferences
   - Co-op/group participation
   - Household income range
   - Education level
   - Expected monthly pricing
   - Maximum willing to pay
   - Net Promoter Score (1-10 likelihood to recommend)

### Implementation Status

**Database**: ✅ Complete - All tables created and populated
**Survey Modal**: 🔄 In Progress - Component development
**Authentication Integration**: ✅ Complete - Integrated into main app layout
- Survey modal appears automatically for parent users with `survey_completed = false`
- Full-screen blocking overlay prevents app interaction until survey completion
- Integrated into `src/app/(app)/layout.tsx` for seamless enforcement
- Automatic profile refresh and page reload after completion
- Survey cannot be closed or dismissed - must be completed to access app
**Admin Dashboard**: 🔄 In Progress - Analytics interface
**UI/UX Polish**: 🔄 In Progress - Apple/Tesla/OpenAI inspired design 