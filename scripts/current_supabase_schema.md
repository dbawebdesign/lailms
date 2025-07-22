# Current Supabase Schema

## Recent Updates

### Study Spaces Course Linking (2025-01-21)
Added course_id column to study_spaces table to enable persistent study spaces per user-course combination:

- **Schema Changes:**
  - Added `course_id UUID` column referencing `base_classes(id)`
  - Added index `idx_study_spaces_user_course` on `(user_id, course_id)`
  - Added unique constraint `unique_user_course_study_space` to ensure one study space per user per course

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

- **2025-01-21**: Added complete Study Space system (6 new tables) + Study Sessions table
- **2025-01-10**: Added AI insights system for learning analytics
- **Previous**: Core educational platform tables (profiles, classes, lessons, etc.) 