# Learnology.ai Database Schema

This document provides an overview of the Learnology.ai database schema implemented in Supabase Postgres.

## Core Schema Components

### Multi-tenancy Structure
- **organisations**: Top-level tenants
- **members**: User profiles linked to organisations
- **base_classes**: Class templates 
- **class_instances**: Actual classes created from templates
- **rosters**: Linking members to class instances with roles

### Learning Content Structure
- **paths**: Learning paths within an organisation
- **lessons**: Individual lessons within a path
- **lesson_sections**: Content sections within a lesson
- **quizzes**: Assessment components linked to lessons
- **questions**: Individual questions within quizzes
- **submissions**: Student quiz submissions and scores

### Study Tools
- **notebooks**: Student notebooks with rich text content
- **mind_maps**: Concept mapping tool data
- **achievements**: Unlockable badges and achievements
- **certificates**: Records of achievement issuance
- **ui_contexts**: UI state tracking for the context engine

### Auxiliary Components
- **audit_logs**: Comprehensive system action tracking
- **enrollment_code_lookup**: Materialized view for quick enrollment code lookup

## Key Features

### Row-Level Security (RLS)
All tables have RLS policies implementing the following permissions model:
- **SUPER_ADMIN**: Access to all data across all organizations
- **ADMIN**: Access to all data within their organization
- **TEACHER**: Access to their classes and student data
- **STUDENT**: Access to their own data and shared class resources

### Vector Search
- pgvector extension enabled for similarity search
- Vector embedding columns in lesson_sections and ui_contexts
- Optimized vector indexes for fast retrieval

### Audit Logging
- Comprehensive audit logging system capturing all CRUD operations
- Records before/after states of all records
- Tracks who performed each action

### Triggers and Automation
- **Updated timestamps**: Automatic tracking of creation and update times
- **Enrollment codes**: Auto-generation of unique enrollment codes
- **Order maintenance**: Automatic reindexing of ordered items (lessons, sections)
- **Materialized view refresh**: Automatic updating of lookup views

## Table Relationships

```
organisations
  ↓
  ├── members
  │    ↓
  │    ├── notebooks
  │    ├── mind_maps
  │    ├── ui_contexts
  │    └── certificates ←── achievements
  │
  ├── base_classes
  │    ↓
  │    └── class_instances ←── rosters
  │
  └── paths
       ↓
       └── lessons
            ↓
            ├── lesson_sections
            └── quizzes
                 ↓
                 ├── questions
                 └── submissions
```

## Recent Improvements (Task 3 Completion)

The following components were added to complete the database schema implementation:

1. **Enrollment Code Generation**: 
   - Automatic generation of unique enrollment codes for class instances

2. **Audit Logging Triggers**:
   - Comprehensive audit logging across all tables
   - Capturing before/after states for all operations

3. **Enrollment Code Lookup**:
   - Materialized view for efficient code validation
   - Automatic refresh when class instances change

4. **Order Maintenance Triggers**:
   - Automatic reindexing of lesson and section order
   - Ensures consistent ordering when items are rearranged

5. **Vector Support Finalization**:
   - Enabled vector columns for content embeddings
   - Optimized indexes for similarity search

6. **Enhanced RLS Policies**:
   - Added SUPER_ADMIN access across all tables
   - Fixed policy inconsistencies

## Usage Examples

### Enrolling a Student in a Class
```sql
-- Insert student into roster using enrollment code
WITH class_info AS (
  SELECT class_instance_id
  FROM public.enrollment_code_lookup
  WHERE enrollment_code = 'ABCD1234'
)
INSERT INTO public.rosters (class_instance_id, member_id, role)
VALUES ((SELECT class_instance_id FROM class_info), 'member-uuid', 'STUDENT');
```

### Finding Content with Vector Search
```sql
-- Find similar content (requires content embedding to be populated)
SELECT 
  ls.id, 
  ls.title, 
  l.title as lesson_title, 
  p.name as path_name,
  1 - (ls.content_embedding <=> query_embedding) as similarity
FROM 
  public.lesson_sections ls
JOIN 
  public.lessons l ON ls.lesson_id = l.id
JOIN 
  public.paths p ON l.path_id = p.id
WHERE 
  p.organisation_id = 'org-uuid'
ORDER BY 
  ls.content_embedding <=> query_embedding
LIMIT 5;
```

### Audit Trail Lookup
```sql
-- Find all changes to a specific record
SELECT 
  al.action, 
  al.old_data, 
  al.new_data, 
  al.performed_at,
  m.first_name || ' ' || m.last_name as performed_by_name
FROM 
  public.audit_logs al
JOIN 
  public.members m ON al.performed_by = m.id
WHERE 
  al.table_name = 'lessons' 
  AND al.record_id = 'lesson-uuid'
ORDER BY 
  al.performed_at DESC;
``` 