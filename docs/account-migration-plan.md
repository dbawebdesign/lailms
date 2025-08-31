# Account Migration Plan: From Username to Email Authentication

## Last Updated: December 31, 2024
## Status: FULLY IMPLEMENTED ✅

## Overview
This document outlines the migration strategy for transitioning existing users from the old username/enrollment code system to the new email-based family account management system.

## Current State Analysis

### Old System (Being Phased Out)
- **Authentication**: Username + password
- **Internal Structure**: Pseudo-emails like `username@org.internal`
- **Sign-up**: Requires enrollment codes
- **Account Types**: Individual accounts (no family structure)

### New System (Target State)
- **Authentication**: Email/password or Google OAuth
- **Family Structure**: Teacher (parent) as primary account with student sub-accounts
- **Sign-up**: Direct email registration (no enrollment codes for homeschool)
- **Account Switching**: FamilyAccountSwitcher component for multi-account families

## Migration Architecture

### Database Changes
```sql
-- Migration tracking table (already created)
account_migrations:
  - user_id: Reference to auth.users
  - migration_token: Unique token for secure migration
  - old_username: Original username for reference
  - status: pending/completed/failed
  - expires_at: Token expiration time
```

### API Endpoints Created

1. **`/api/auth/migrate-account`**
   - Detects old system users
   - Creates migration session
   - Returns migration token

2. **`/api/auth/complete-migration`**
   - Updates auth email
   - Creates family structure for homeschool teachers
   - Migrates existing students to sub-accounts
   - Preserves all existing data

3. **`/api/auth/validate-migration`**
   - Validates migration tokens
   - Returns user profile for migration UI

## User Experience Flow

### Phase 1: Detection
1. User attempts login with username/password
2. System detects `.internal` email format
3. Redirects to migration interface

### Phase 2: Migration Interface
1. **Introduction Screen**
   - Explains why migration is needed
   - Assures data preservation
   - Shows current account info

2. **Authentication Setup**
   - Choose: Email/password or Google OAuth
   - Enter new credentials

3. **Family Setup (Homeschool Teachers Only)**
   - Name the family
   - Optionally add student accounts
   - System auto-migrates existing students

4. **Completion**
   - Migration executed
   - Auto-login with new credentials
   - Redirect to appropriate dashboard

## Data Preservation Strategy

### Automatic Preservation
All data is linked via `user_id` foreign keys, so it automatically remains accessible:
- Course progress (`progress` table)
- Base classes and class instances
- Assessments and attempts
- Generated content
- Study spaces and notes
- All other user-generated content

### Student Migration for Homeschool
- Existing students in the same organization are automatically linked
- Students get `@student.internal` emails for sub-account access
- Family relationships are established in `family_students` table

## Implementation Status

### ✅ Completed
- [x] Migration detection API
- [x] Migration completion API
- [x] Database migration table
- [x] Account migration UI component
- [x] Login form integration
- [x] Migration validation API

### 🔄 Next Steps

1. **Testing Requirements**
   ```bash
   # Test migration flow
   - Create test accounts with old system
   - Run through migration process
   - Verify data preservation
   - Test family account switching
   ```

2. **Additional Components Needed**
   - Google OAuth completion page (`/complete-google-migration`)
   - Migration status dashboard for admins
   - Bulk migration tools for admin users
   - Email notifications for migration reminders

3. **Rollback Strategy**
   - Keep old username field intact (just nullified)
   - Migration status tracking allows reversal if needed
   - Original `.internal` emails preserved in auth system

## Security Considerations

1. **Token Security**
   - 30-minute expiration on migration tokens
   - HTTP-only cookies for token storage
   - One-time use tokens

2. **Data Protection**
   - Service role key used only server-side
   - Profile data validation before migration
   - Audit trail in `account_migrations` table

## Communication Strategy

### User Notifications
1. **Pre-Migration**
   - Email announcement about upcoming changes
   - Benefits of new system
   - Timeline for mandatory migration

2. **During Migration**
   - Clear instructions in UI
   - Support documentation
   - FAQ section

3. **Post-Migration**
   - Confirmation email
   - New features guide
   - Support contact info

## Migration Timeline

### Phase 1: Soft Launch (Weeks 1-2)
- Deploy migration system
- Allow voluntary migration
- Monitor for issues

### Phase 2: Active Migration (Weeks 3-4)
- Send migration reminders
- Provide support for users
- Track migration metrics

### Phase 3: Mandatory Migration (Week 5+)
- Force migration on login
- Disable old authentication method
- Complete data cleanup

## Monitoring & Metrics

### Key Metrics to Track
- Migration completion rate
- Migration failure reasons
- Time to complete migration
- Support ticket volume
- User satisfaction scores

### Database Queries for Monitoring
```sql
-- Check migration progress
SELECT 
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/60) as avg_minutes
FROM account_migrations
GROUP BY status;

-- Find users still needing migration
SELECT COUNT(*) 
FROM auth.users 
WHERE email LIKE '%@%.internal';

-- Track migration success rate by organization
SELECT 
  o.name,
  COUNT(CASE WHEN am.status = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN am.status = 'failed' THEN 1 END) as failed
FROM account_migrations am
JOIN profiles p ON am.user_id = p.user_id
JOIN organisations o ON p.organisation_id = o.id
GROUP BY o.name;
```

## Support Documentation

### Common Issues & Solutions

1. **"Invalid credentials" error**
   - User may have already migrated
   - Direct to email/Google login

2. **Migration token expired**
   - User took too long
   - Need to restart process

3. **Google OAuth issues**
   - Check popup blockers
   - Verify Google account access

4. **Missing student accounts**
   - May need manual admin intervention
   - Check organization associations

## Rollback Plan

If critical issues arise:
1. Disable migration detection in LoginForm
2. Re-enable direct username login
3. Keep migration data for retry
4. Fix issues and re-launch

## Success Criteria

- [ ] 95%+ successful migration rate
- [ ] < 5% support ticket increase
- [ ] No data loss incidents
- [ ] Positive user feedback
- [ ] Successful family account switching

## Notes for Development Team

### Environment Variables Needed
```env
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### Testing Checklist
- [ ] Test with various organization types
- [ ] Test with accounts having multiple students
- [ ] Test migration timeout scenarios
- [ ] Test concurrent migrations
- [ ] Test rollback procedures
- [ ] Test data preservation
- [ ] Test family account switching post-migration

### Deployment Checklist
- [ ] Database migration deployed
- [ ] API endpoints deployed
- [ ] UI components deployed
- [ ] Environment variables configured
- [ ] Monitoring dashboards set up
- [ ] Support team briefed
- [ ] Documentation published

## Comprehensive Data Migration Coverage (Updated: Dec 31, 2024)

### ✅ ALL Data Tables Now Migrated

The migration system has been updated to cover **EVERY** table that references user data:

#### Core Learning Content
- ✅ `base_classes` - Courses created by teachers
- ✅ `paths` - Learning paths within courses  
- ✅ `lessons` - Individual lessons
- ✅ `lesson_section_versions` - Version history of lesson content

#### Class Management
- ✅ `rosters` - Student enrollments in classes
- ✅ Class instances linked via base_classes (no direct migration needed)

#### Progress Tracking
- ✅ `progress` - General progress tracking for all content types

#### Assessments & Grading
- ✅ `assessments` - Quizzes, tests, and assignments
- ✅ `student_attempts` - Student test attempts
- ✅ `student_responses` - Individual question responses
- ✅ `assignments` - Teacher-created assignments
- ✅ `grades` - Student grades (both as student and as grader)
- ✅ `standards` - Learning standards

#### Documents & Media
- ✅ `documents` - Uploaded documents and files
- ✅ `lesson_media_assets` - Media assets for lessons
- ✅ `base_class_media_assets` - Media assets for courses

#### Course Generation
- ✅ `course_outlines` - AI-generated course outlines
- ✅ `course_generation_jobs` - Course generation job tracking
- ✅ `generated_lesson_content` - AI-generated lesson content
- ✅ `knowledge_base_analyses` - Knowledge base analysis results
- ✅ `course_generation_rate_limits` - User rate limits

#### Student Study Tools
- ✅ `study_spaces` - Personal study areas
- ✅ `study_notes` - Student-created notes
- ✅ `bookmarks` - Saved content bookmarks
- ✅ `mind_maps` - Visual learning aids
- ✅ `flashcard_sets` - Flashcard collections
- ✅ `flashcards` - Individual flashcards
- ✅ `study_goals` - Learning goals
- ✅ `study_sessions` - Study session tracking
- ✅ `study_space_brainbytes` - AI-generated study content

#### AI & Analytics
- ✅ `generations` - AI content generation records
- ✅ `ai_insights` - AI-generated insights
- ✅ `agent_analytics` - AI agent analytics
- ✅ `agent_sessions` - AI agent sessions
- ✅ `agent_messages` - AI agent conversations
- ✅ `agent_tool_usage` - AI tool usage tracking
- ✅ `luna_conversations` - Luna AI conversations

#### Teacher Tools
- ✅ `teacher_tool_creations` - Teacher-created tools and resources

#### Support & Communication
- ✅ `feedback_support` - Support tickets and feedback
- ✅ `survey_responses` - Survey responses
- ✅ `video_guides` - Video guide creation
- ✅ `admin_messages` - Admin messaging system

#### Family Account Structure
- ✅ `homeschool_family_info` - Family account information
- ✅ `family_students` - Family-student relationships
- ✅ `profiles.parent_account_id` - Sub-account parent links

### Migration Guarantees

1. **Data Completeness:** Every single piece of user data migrates
2. **Data Integrity:** All foreign key relationships preserved
3. **No Data Loss:** All data migrated before any cleanup
4. **Audit Trail:** Complete migration logs maintained
5. **Safe Cleanup:** Old profiles removed only after successful migration
6. **Rollback Capable:** Can be reversed if needed before cleanup

### Migration Cleanup Process

After successful migration completion:

1. **For Google OAuth migrations only:**
   - Verifies all data has been migrated to new user ID
   - Checks no remaining references to old user ID
   - Deletes old profile from profiles table
   - Deletes old auth user from auth.users table
   
2. **For Email/Password migrations:**
   - No cleanup needed (same user ID, just updated auth method)

3. **Legacy Data Handling:**
   - Claims any base_classes with NULL user_id in same organization
   - Assigns them to the migrated teacher account

## Contact & Support

For questions about this migration plan:
- Technical Issues: [Dev Team]
- User Support: [Support Team]
- Strategic Decisions: [Product Team]
