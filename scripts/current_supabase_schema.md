# Current Supabase Schema

## Latest Updates (Assessment Questions & Delete Functionality)

### Assessment Questions Answer Key Validation (2025-01-31)
The `assessment_questions` table has a check constraint `valid_answer_key` that validates the structure of the `answer_key` JSONB field based on the question type:

**Multiple Choice Questions:**
```json
{
  "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
  "correct_option": "Option 1"
}
```

**True/False Questions:**
```json
{
  "correct_answer": true
}
```

**Short Answer Questions:**
```json
{
  "acceptable_answers": ["answer1", "answer2", "answer3"]
}
```

**Essay Questions:**
```json
{
  "grading_criteria": "Detailed grading criteria text..."
}
```

**Matching Questions:**
```json
{
  "pairs": [
    {"left": "Item 1", "right": "Match 1"},
    {"left": "Item 2", "right": "Match 2"}
  ]
}
```

The validation is enforced by the `validate_question_answer_key(question_type, answer_key)` function.

## Previous Updates (Delete Functionality & RLS Improvements)

### Lesson Section Delete RLS Policy Update (2025-01-31)
Updated the lesson_sections DELETE RLS policy to allow users to delete sections from lessons they created, even if the section's `created_by` field is NULL:

```sql
CREATE POLICY "Users can delete their own lesson sections" ON lesson_sections
FOR DELETE TO authenticated
USING (
  created_by = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM lessons l 
    WHERE l.id = lesson_sections.lesson_id 
    AND l.creator_user_id = auth.uid()
  )
);
```

This resolves issues where users couldn't delete sections that were created during course generation (which had NULL `created_by` values) but belonged to lessons they created.

### Lesson Section Delete Trigger Fix (2025-01-31)
Fixed the `reindex_sections_after_delete()` function to prevent stack depth limit exceeded errors:

```sql
CREATE OR REPLACE FUNCTION reindex_sections_after_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Set flag to prevent recursive trigger calls
    PERFORM set_config('app.bulk_reordering_in_progress', 'true', true);
    
    -- Reindex the remaining sections in the lesson to ensure no gaps
    WITH ordered_sections AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY order_index) - 1 AS new_order
        FROM public.lesson_sections
        WHERE lesson_id = OLD.lesson_id
    )
    UPDATE public.lesson_sections AS s
    SET order_index = os.new_order
    FROM ordered_sections AS os
    WHERE s.id = os.id;
    
    -- Clear the flag
    PERFORM set_config('app.bulk_reordering_in_progress', 'false', true);
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;
```

This prevents recursive trigger calls that were causing stack depth errors when deleting lesson sections.

## Previous Updates (Sub-Account Support)

- **profiles table enhancements for sub-accounts:**
  - `is_sub_account` (BOOLEAN, default FALSE) - Indicates if this is a sub-account (student without auth)
  - `parent_account_id` (UUID) - Links sub-accounts to their parent account
  - Students are now created as sub-accounts without separate auth accounts
  - Parents can switch between family member accounts using the account switcher

- **New RLS Policies:**
  - "Parents can manage their sub-accounts" - Allows parent accounts to manage student profiles
  - "Parents can create sub-accounts" - Allows parents to create student profiles
  - **Progress table family support** - Updated RLS policies to allow parents to manage progress for their sub-accounts
  - **Assessment tables family support** - Updated RLS policies for student_attempts and student_responses to support family accounts

## Recent Updates

### Lesson Section Reordering Fix (2025-01-31)
Fixed the `reorder_lesson_sections` function to resolve stack depth errors and constraint violations:
- Updated the function to use 0-based indexing to match frontend expectations
- Implemented two-phase update process to avoid unique constraint violations on (lesson_id, order_index)
- First phase moves sections to temporary high order_index values, second phase sets final 0-based values
- This resolves stack depth errors that occurred during section reordering in the studio interface

### Homeschool Family Structure Enhancement (2025-01-30)
Added comprehensive family account structure for homeschool users:

- **Schema Changes:**
  - Added `max_students` (integer, default 4) to `organisations` table for student limits
  - Added `subscription_status` (text, default 'pending') to track subscription state
  - Added `subscription_started_at` and `subscription_expires_at` for subscription management
  - Added `family_id` to `profiles` table to link students to families
  - Added `is_primary_parent` (boolean) to identify primary family account holder
  - Added `onboarding_completed` and `onboarding_step` for tracking onboarding progress
  - Made `username` column nullable in `profiles` table (homeschool accounts don't require usernames)

- **New Tables:**
  - `family_students`: Links students to their family accounts
  - `coop_members`: Tracks families that are part of homeschool co-ops

- **Row Level Security Policies Added:**
  - **Organisations Table:**
    - Users can create their own organisation
    - Users can update their own organisation
    - Users can view organisations (for joining co-ops)
  
  - **Organisation Units Table:**
    - Users can create units for their organisation
    - Users can view and update units in their organisation
  
  - **Homeschool Family Info Table:**
    - Primary parents can create, view, and update family info
    - Family members can view family info
  
  - **Family Students Table:**
    - Parents can add and manage students in their family
    - Students can view their family association
  
  - **Invite Codes Table:**
    - Modified trigger function to use SECURITY DEFINER for system-level access
    - Homeschool organizations (individual_family, homeschool_coop) skip invite code generation
    - System can create invite codes through triggers

- **Features:**
  - **Family Account Structure**: Primary parent account manages student accounts
  - **Student Limits**: Enforces max 4 students per standard family account
  - **Co-op Support**: Families can join homeschool co-ops/networks
  - **Onboarding Tracking**: Progressive onboarding flow state management
  - **RLS Policies**: Secure access control for family and co-op data

### Stripe Payment Integration (2025-01-29)
Added comprehensive payment tracking and Stripe integration for homeschool signup flow:

- **Schema Changes:**
  - Added `paid` (boolean, default false) to `profiles` table
  - Added `paid_at` (timestamptz) to track payment completion time
  - Added `stripe_customer_id` (text) to link users to Stripe customers
  - Added `stripe_payment_intent_id` (text) to track specific payment transactions
  - Added `stripe_receipt_url` (text) to store receipt links
  - Added `payment_amount_cents` (integer) to track payment amounts
  - Added `payment_currency` (text, default 'usd') to track payment currency
  - Added indexes on `paid` and `stripe_customer_id` for query performance

- **Features:**
  - **Payment Flow Integration**: Seamless redirect from signup to Stripe payment link
  - **Webhook Processing**: Automatic profile updates when payments complete
  - **Payment Tracking**: Complete audit trail of user payments and receipts
  - **Status Checking**: API endpoint to verify payment status for authenticated users

- **API Endpoints:**
  - `/api/stripe/webhook` - POST: Process Stripe webhook events
  - `/api/payment/status` - GET: Check current user's payment status

- **Integration Points:**
  - Connected to signup flow with automatic payment redirect
  - Webhook updates user profiles upon successful payment
  - Payment success page provides user feedback and login redirect
  - Support for both one-time and subscription payments

### Enhanced Course Generation Tracking System (2025-01-29)
Added comprehensive task-level tracking, error management, and recovery capabilities for course generation:

- **New Tables:**
  - `course_generation_tasks`: Granular task tracking with status, dependencies, timing, and error details
  - `course_generation_errors`: Comprehensive error logging with classification and recovery suggestions
  - `course_generation_analytics`: Performance metrics, quality scores, and resource usage tracking
  - `course_generation_user_actions`: Tracking of user interventions and recovery actions

- **Enhanced Features:**
  - **Task-Level Persistence**: All generation tasks now persisted with full state tracking
  - **Intelligent Retry System**: Configurable retry logic with backoff strategies
  - **Granular Error Handling**: Detailed error classification with recovery suggestions
  - **Performance Analytics**: Comprehensive metrics for optimization and evaluation
  - **User Recovery Actions**: Database tracking of user interventions and success rates
  - **Dependency Management**: Sophisticated task dependency resolution and validation

- **Database Functions:**
  - `calculate_job_completion_percentage()`: Real-time progress calculation
  - `check_task_dependencies_ready()`: Dependency validation for task execution

- **Impact:**
  - Enables granular progress tracking and intelligent recovery from failures
  - Provides detailed analytics for system optimization and failure analysis
  - Supports user-driven recovery workflows with skip/retry capabilities
  - Creates foundation for 98%+ success rate through comprehensive error handling

### Document Chunks Base Class ID Fix (2025-01-28)
Fixed critical missing column in document_chunks table that was causing large PDF processing failures:

- **Schema Changes:**
  - Added `base_class_id UUID` column to `document_chunks` table (nullable)
  - Added foreign key constraint `fk_document_chunks_base_class_id` referencing `base_classes(id)` with CASCADE delete
  - Added index `idx_document_chunks_base_class_id` for query performance
  - Updated existing document_chunks to inherit `base_class_id` from their parent documents

- **Problem Solved:**
  - Large PDF processing was failing with 500 error: "Could not find the 'base_class_id' column of 'document_chunks' in the schema cache"
  - Edge function `process-document` was attempting to insert `base_class_id` but column didn't exist
  - All document chunks now properly linked to their base class for proper data relationships

- **Impact:**
  - Large PDF processing (325+ pages, 5MB+) now works correctly
  - Smart sampling strategy can complete successfully 
  - Document chunks properly associated with courses/classes
  - Maintains data consistency across the knowledge base system

### Study Spaces Course Linking (2025-01-21)
Added course_id column to study_spaces table to enable persistent study spaces per user-course combination:

- **Schema Changes:**
  - Added `course_id UUID` column referencing `base_classes(id)`
  - Added index `idx_study_spaces_user_course` on `(user_id, course_id)`
  - Added unique constraint `unique_study_space_per_user_course` to ensure one study space per user per course (partial index where course_id IS NOT NULL)

- **Purpose:**
  - Enables persistent study spaces that are linked to specific courses
  - Prevents creation of multiple study spaces for the same user-course combination
  - Allows users to return to the same study space with all their notes, mindmaps, and content preserved
  - **Study Materials Isolation:** Mind maps, notes, and other study materials are now properly filtered by study_space_id, ensuring each study space shows only its own content

### User Notes Content Storage RLS Policies (2025-01-21)
Added Row-Level Security policies for the `user-notes-content` storage bucket to support media uploads in the notes editor:

- **Policies Added:**
  - `Users can upload to user-notes-content bucket`: Allows authenticated users to upload files
  - `Users can view user-notes-content files`: Public read access for all uploaded files
  - `Users can update their own user-notes-content files`: Users can update files they uploaded
  - `Users can delete their own user-notes-content files`: Users can delete files they uploaded

- **Security Model:**
  - Files are organized by user ID in folder structure: `/{user_id}/filename`
  - Users can only modify/delete files in their own folder
  - All files are publicly readable (bucket is public)
  - Upload requires authentication

### Class Instance Status Automation (2025-01-21)
Added automatic status management for class instances based on start and end dates:

- **Functions Added:**
  - `update_class_instance_status()`: Updates all class instance statuses based on current date
  - `update_single_class_instance_status()`: Trigger function for individual updates
  - `daily_class_instance_status_update()`: Returns JSON summary of updates performed

- **Trigger Added:**
  - `class_instance_status_trigger`: Automatically updates status when start_date or end_date is modified

- **Status Logic:**
  - `upcoming`: start_date is in the future
  - `active`: start_date is today or in the past, end_date hasn't passed
  - `completed`: end_date is in the past

- **API Endpoint:** `/api/dev-admin/class-instance-status-update`
  - POST: Triggers status update manually
  - GET: Shows current status analysis without making changes

This document tracks the current state of our Supabase database schema.

### Luna AI Chat Tables (2025-01-21)
Added comprehensive Luna AI chat functionality with conversation persistence:

- **Tables Added:**
  - `luna_conversations`: Stores conversation metadata with personas, titles, and settings
  - `luna_messages`: Stores individual messages with context data and embeddings
  - `luna_contexts`: Stores conversation context including study materials and user state
  - `luna_citations`: Links messages to source materials for citation tracking

- **Features:**
  - Full conversation persistence across sessions
  - Context-aware responses based on study materials
  - Support for multiple personas (chat, teacher, tutor)
  - Citation tracking for academic integrity
  - Message search and conversation management
  - Study space integration with real-time context

- **Integration Points:**
  - Connected to study_notes for note-taking integration
  - Links to lesson_sections for content context
  - Integrates with study_sessions for tracking

## Core Tables

### Profiles
- **Purpose**: User profiles and role management
- **Key Fields**: user_id (PK), organisation_id, role, active_role
- **Relationships**: Links to auth.users and organisations

### Organisations  
- **Purpose**: Organization/school management
- **Key Fields**: id (PK), name, organisation_type, settings
- **Features**: Supports homeschool, coop, and institutional types

### Base Classes
- **Purpose**: Core curriculum templates
- **Key Fields**: id (PK), title, subject, grade_level, organisation_id
- **Features**: AI-generated content, knowledge base integration

### Class Instances
- **Purpose**: Active course offerings
- **Key Fields**: id (PK), base_class_id, name, instructor_id, organisation_id
- **Features**: Scheduling, enrollment management

### Lesson Sections
- **Purpose**: Individual lesson content and materials
- **Key Fields**: id (PK), base_class_id, title, content, content_embedding
- **Features**: Vector embeddings for semantic search, AI content generation

### Rosters
- **Purpose**: Student enrollment in class instances
- **Key Fields**: id (PK), class_instance_id, student_id, organisation_id
- **Features**: Tracks student participation and progress

## Study Space System (New - Added 2025-01-21)

### Study Spaces
- **Purpose**: Personal study areas for students
- **Key Fields**: id (PK), user_id, organisation_id, name, description, color, is_default
- **Features**: Customizable study environments with color coding and settings

### Study Notes  
- **Purpose**: Rich text notes with AI search capabilities
- **Key Fields**: id (PK), study_space_id, user_id, title, content, content_embedding
- **Features**: Vector embeddings for semantic search, tags, favorites

### Bookmarks
- **Purpose**: Resource bookmarking with folder organization
- **Key Fields**: id (PK), study_space_id, user_id, title, url, folder_path
- **Features**: Hierarchical folder structure, metadata extraction

### Mind Maps
- **Purpose**: Visual knowledge mapping and brainstorming
- **Key Fields**: id (PK), study_space_id, user_id, title, mind_map_data (JSONB)
- **Features**: JSON storage of nodes and connections, collaborative editing
- **Note**: Uses embedded JSON structure rather than separate node/connection tables

### Study Sessions
- **Purpose**: Time tracking and study analytics  
- **Key Fields**: id (PK), study_space_id, user_id, start_time, end_time, activity_data
- **Features**: Detailed activity tracking, productivity metrics

### Study Goals
- **Purpose**: Goal setting and progress tracking
- **Key Fields**: id (PK), study_space_id, user_id, title, target_date, progress
- **Features**: SMART goal framework, milestone tracking

## Content Indexing System (New - Added 2025-01-22)

### Study Content Index
- **Purpose**: Unified content search and indexing for Study Spaces
- **Key Fields**: id (PK), base_class_id, organisation_id, content_type, source_table, source_id, title, content_text, content_embedding
- **Content Types**: course, module, lesson, section, media, assessment, document
- **Features**: Vector embeddings (1536-dim), full-text search, hierarchical relationships, automatic reindexing
- **Search Functions**: search_study_content() for vector search, search_study_content_text() for full-text search

### Content Reindex Queue
- **Purpose**: Background processing queue for content updates
- **Key Fields**: id (PK), source_table, source_id, base_class_id, priority, status
- **Features**: Automatic triggers on content changes, priority-based processing

### Content Indexing Jobs
- **Purpose**: Job tracking for content aggregation processes
- **Key Fields**: id (PK), base_class_id, organisation_id, status, progress, stats
- **Features**: Progress monitoring, error tracking, performance metrics

## Security & Access Control

All tables implement Row Level Security (RLS) policies following these patterns:
- **User Isolation**: Users can only access their own data
- **Organization Scope**: Teachers/admins can view student data within their organization
- **Role-Based Access**: Different permissions for students, teachers, and administrators

## Study Sessions Table (2025-01-21)

### `study_sessions`
- **Purpose**: Track user study activities and analytics
- **Key Fields**: 
  - `id` (UUID, primary key)
  - `study_space_id` (UUID, NOT NULL) - References study_spaces
  - `user_id` (UUID, NOT NULL) - References auth.users  
  - `organisation_id` (UUID, NOT NULL) - References organisations
  - `session_type` (text, NOT NULL) - Type of study session
  - `duration_minutes` (integer, nullable)
  - `started_at` (timestamptz, default NOW())
  - `ended_at` (timestamptz, nullable)
  - `linked_lesson_id` (UUID, nullable) - References lessons
  - `linked_lesson_section_id` (UUID, nullable) - References lesson_sections
  - `linked_path_id` (UUID, nullable) - References paths
  - `notes_created` (integer, default 0)
  - `flashcards_reviewed` (integer, default 0)
  - `bookmarks_added` (integer, default 0)
  - `session_data` (jsonb, default '{}')
  - `quality_rating` (integer, nullable)
  - `created_at` (timestamptz, default NOW())
  - `updated_at` (timestamptz, default NOW())

**Features**:
- Session tracking with start/end times
- Links to specific learning content (lessons, paths, sections)
- Activity metrics (notes, flashcards, bookmarks)
- Quality ratings and session metadata
- Required organization and study space associations

**Integration Points**:
- Used by study space for session tracking
- Links to learning content for analytics
- Provides data for progress tracking and insights

## Recent Updates

### Enhanced Document Processing System (2025-01-21)
**Added:** Enhanced document processing with comprehensive progress tracking, error handling, and large file support (up to 50MB PDFs with 1000+ pages).

#### Documents Table - Enhanced Metadata Structure

The `documents.metadata` JSONB field now supports detailed processing information:

```json
{
  // Processing Progress
  "processing_progress": {
    "stage": "extracting_text|chunking_text|generating_embeddings|storing_chunks|summarizing|finalizing",
    "substage": "downloading_file|parsing_pdf|validating_content|creating_chunks|batch_embedding_generation|database_insertion|cleanup",
    "percentage": 75,
    "currentStep": 3,
    "totalSteps": 5,
    "estimatedTimeRemaining": 120,
    "pagesProcessed": 150,
    "totalPages": 200,
    "chunksCreated": 85,
    "embeddings_generated": 60
  },
  
  // Error Information
  "processing_error": {
    "code": "PDF_NO_TEXT|PDF_ENCRYPTED|PROCESSING_TIMEOUT|MEMORY_EXCEEDED",
    "message": "Technical error message",
    "userFriendlyMessage": "This PDF appears to be scanned or contains no readable text",
    "suggestedActions": [
      "Use an OCR tool to convert scanned images to text",
      "Remove password protection if the PDF is encrypted"
    ],
    "retryable": true,
    "timestamp": "2024-01-15T10:30:00Z"
  },
  
  // Processing Results
  "extracted_text_length": 125000,
  "chunks_created": 95,
  "processing_time_seconds": 45,
  
  // Retry Information
  "retry_count": 0,
  "last_retry_at": "2024-01-15T10:35:00Z",
  
  // Performance Metrics
  "processing_start_time": "2024-01-15T10:30:00Z",
  "processing_end_time": "2024-01-15T10:30:45Z",
  "memory_usage_mb": 128,
  "peak_memory_mb": 256,
  
  // File Information
  "total_pages": 200,
  "file_size": 5242880
}
```

#### Enhanced Processing Features

- **Large File Support**: Up to 50MB PDFs with 1000+ pages
- **Memory Management**: Batch processing (50 pages at a time)
- **Timeout Protection**: 8-minute processing limit with early termination
- **Progress Reporting**: Real-time updates every 20 pages for extraction, every 50 chunks for processing
- **Structured Error Handling**: User-friendly error messages with suggested actions
- **Retry Functionality**: API endpoints for retrying failed processing
- **Real-time Updates**: Supabase subscriptions + fallback polling

#### Error Codes and User-Friendly Messages

- **PDF_NO_TEXT**: Scanned PDF or no readable content
- **PDF_ENCRYPTED**: Password-protected PDF
- **PDF_NO_READABLE_PAGES**: No readable pages found
- **PROCESSING_TIMEOUT**: Processing took too long (8+ minutes)
- **MEMORY_EXCEEDED**: Document too large for available memory
- **PDF_PROCESSING_ERROR**: General PDF processing failure
- **USER_CANCELLED**: Processing cancelled by user

#### API Endpoints Added

- `/api/knowledge-base/retry-processing` - POST: Retry failed document processing
- `/api/knowledge-base/cancel-processing` - POST: Cancel active document processing

- **2025-01-21**: Added complete Study Space system (6 new tables) + Study Sessions table
- **2025-01-10**: Added AI insights system for learning analytics
- **Previous**: Core educational platform tables (profiles, classes, lessons, etc.) 