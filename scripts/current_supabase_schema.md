# Current Supabase Schema

## Recent Updates

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

## Recent Updates

- **2025-01-21**: Added complete Study Space system (6 new tables)
- **2025-01-10**: Added AI insights system for learning analytics
- **Previous**: Core educational platform tables (profiles, classes, lessons, etc.) 