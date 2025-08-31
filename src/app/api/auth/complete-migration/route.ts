import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

interface CompleteMigrationRequest {
  email: string
  password?: string
  useGoogle?: boolean
  migrationToken: string
  familyName?: string
  students?: Array<{
    firstName: string
    gradeLevel: string
  }>
}

export async function POST(request: NextRequest) {
  try {
    const body: CompleteMigrationRequest = await request.json()
    const { email, password, useGoogle, migrationToken, familyName, students = [] } = body

    // Validate inputs
    if (!email || !migrationToken) {
      return NextResponse.json({ error: 'Email and migration token required' }, { status: 400 })
    }

    if (!useGoogle && !password) {
      return NextResponse.json({ error: 'Password required for email authentication' }, { status: 400 })
    }

    // Initialize admin client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verify migration token
    console.log('Complete migration - validating token:', migrationToken)
    const { data: migration, error: migrationError } = await supabase
      .from('account_migrations')
      .select('*')
      .eq('migration_token', migrationToken)
      .eq('status', 'pending')
      .gte('expires_at', new Date().toISOString())
      .single()

    if (migrationError || !migration) {
      console.log('Complete migration - token validation failed:', migrationError, 'Migration found:', !!migration)
      return NextResponse.json({ error: 'Invalid or expired migration token' }, { status: 401 })
    }

    console.log('Complete migration - token validation successful:', migration.id)

    // Get full profile and related data
    const { data: oldProfile } = await supabase
      .from('profiles')
      .select(`
        *,
        organisations (
          id,
          name,
          organisation_type,
          abbr
        )
      `)
      .eq('user_id', migration.user_id)
      .single()

    if (!oldProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Check if this is a homeschool organization migration
    const isHomeschool = oldProfile.organisations?.organisation_type === 'individual_family' || 
                        oldProfile.organisations?.organisation_type === 'homeschool_coop'

    let newUserId = migration.user_id
    let updatedUser = null

    if (!useGoogle) {
      // For email/password: Update the existing user's email and password
      const { data: authUser, error: updateError } = await supabase.auth.admin.updateUserById(
        migration.user_id,
        {
          email: email,
          password: password,
          email_confirm: true
        }
      )

      if (updateError) {
        console.error('Auth update error:', updateError)
        return NextResponse.json({ error: 'Failed to update authentication' }, { status: 500 })
      }
      updatedUser = authUser
    } else {
      // For Google OAuth: Find the new user that was created by Google OAuth
      const { data: googleUsers, error: getUserError } = await supabase.auth.admin.listUsers()
      if (getUserError) {
        console.error('Failed to list users:', getUserError)
        return NextResponse.json({ error: 'Authentication verification failed' }, { status: 500 })
      }

      // Find the user with the matching email (the new Google OAuth user)
      const googleUser = googleUsers.users.find(user => user.email === email)
      if (!googleUser) {
        console.error('Google OAuth user not found for email:', email)
        return NextResponse.json({ error: 'Google authentication not found' }, { status: 500 })
      }

      newUserId = googleUser.id
      updatedUser = googleUser
      console.log('Found Google OAuth user:', googleUser.id, 'for email:', email)
    }

    // Create or update the profile for the new user
    if (useGoogle) {
      // For Google OAuth: Create a new profile for the new user
      await supabase
        .from('profiles')
        .insert({
          user_id: newUserId,
          first_name: oldProfile.first_name,
          last_name: oldProfile.last_name,
          role: oldProfile.role,
          organisation_id: oldProfile.organisation_id,
          organisation_unit_id: oldProfile.organisation_unit_id,
          settings: oldProfile.settings,
          additional_roles: oldProfile.additional_roles,
          active_role: oldProfile.active_role,
          survey_completed: oldProfile.survey_completed,
          paid: oldProfile.paid,
          paid_at: oldProfile.paid_at,
          stripe_customer_id: oldProfile.stripe_customer_id,
          stripe_payment_intent_id: oldProfile.stripe_payment_intent_id,
          stripe_receipt_url: oldProfile.stripe_receipt_url,
          payment_amount_cents: oldProfile.payment_amount_cents,
          payment_currency: oldProfile.payment_currency,
          onboarding_completed: oldProfile.onboarding_completed,
          onboarding_step: oldProfile.onboarding_step
        })
    }

    // If homeschool, set up or link to existing family structure
    if (isHomeschool && ['teacher', 'admin', 'super_admin'].includes(oldProfile.role)) {
      // First check if family structure already exists for this organization
      const { data: existingFamily, error: familyCheckError } = await supabase
        .from('homeschool_family_info')
        .select(`
          *,
          organisation_units (*)
        `)
        .eq('organisation_id', oldProfile.organisation_id)
        .single()

      let familyInfo = existingFamily
      let orgUnit = existingFamily?.organisation_units

      if (!existingFamily) {
        // Create new family structure if none exists
        const { data: newOrgUnit, error: orgUnitError } = await supabase
          .from('organisation_units')
          .insert({
            organisation_id: oldProfile.organisation_id,
            name: familyName || `${oldProfile.first_name} Family`,
            unit_type: 'family'
          })
          .select()
          .single()

        if (!orgUnitError && newOrgUnit) {
          orgUnit = newOrgUnit
          
          // Create family info record
          const { data: newFamilyInfo, error: familyError } = await supabase
            .from('homeschool_family_info')
            .insert({
              organisation_id: oldProfile.organisation_id,
              organisation_unit_id: newOrgUnit.id,
              family_name: familyName || `${oldProfile.first_name} Family`,
              primary_parent_id: newUserId
            })
            .select()
            .single()
          
          if (!familyError) {
            familyInfo = newFamilyInfo
          }
        }
      } else {
        // Update existing family to point to new user if using Google OAuth
        if (useGoogle) {
          await supabase
            .from('homeschool_family_info')
            .update({ primary_parent_id: newUserId })
            .eq('id', existingFamily.id)
        }
      }

      if (familyInfo && orgUnit) {
        // Update teacher profile with family info
        await supabase
          .from('profiles')
          .update({
            family_id: familyInfo.id,
            is_primary_parent: true,
            organisation_unit_id: orgUnit.id,
            username: null // Clear old username
          })
          .eq('user_id', newUserId)

        // Migrate existing student accounts in the same organization
        const { data: existingStudents } = await supabase
          .from('profiles')
          .select('*')
          .eq('organisation_id', oldProfile.organisation_id)
          .eq('role', 'student')
          .is('family_id', null) // Only migrate students not already in a family

        if (existingStudents && existingStudents.length > 0) {
          for (const student of existingStudents) {
            // Create sub-account email for student
            const studentEmail = `${student.username || student.user_id}@student.internal`
            
            // Update student auth record
            await supabase.auth.admin.updateUserById(student.user_id, {
              email: studentEmail
            })

            // Update student profile
            await supabase
              .from('profiles')
              .update({
                family_id: familyInfo.id,
                parent_account_id: newUserId,
                is_sub_account: true,
                organisation_unit_id: orgUnit.id,
                username: null // Clear old username
              })
              .eq('user_id', student.user_id)

            // Create family_students relationship (ignore if already exists)
            await supabase
              .from('family_students')
              .insert({
                family_id: familyInfo.id,
                student_id: student.user_id,
                created_by: newUserId
              })
              .onConflict('family_id,student_id')
              .ignoreDuplicates()
          }
        }

        // Create new student accounts if provided
        for (const newStudent of students) {
          // Create auth user for student
          const studentEmail = `${newStudent.firstName.toLowerCase()}_${Date.now()}@student.internal`
          const tempPassword = crypto.randomUUID()

          const { data: studentAuth } = await supabase.auth.admin.createUser({
            email: studentEmail,
            password: tempPassword,
            email_confirm: true
          })

          if (studentAuth?.user) {
            // Create student profile
            await supabase
              .from('profiles')
              .insert({
                user_id: studentAuth.user.id,
                first_name: newStudent.firstName,
                grade_level: newStudent.gradeLevel,
                role: 'student',
                organisation_id: oldProfile.organisation_id,
                organisation_unit_id: orgUnit.id,
                family_id: familyInfo.id,
                parent_account_id: newUserId,
                is_sub_account: true
              })

            // Create family relationship
            await supabase
              .from('family_students')
              .insert({
                family_id: familyInfo.id,
                student_id: studentAuth.user.id,
                created_by: newUserId
              })
          }
        }
      }
    } else {
      // Non-homeschool migration - just update the profile
      await supabase
        .from('profiles')
        .update({
          username: null // Clear old username
        })
        .eq('user_id', newUserId)
    }

    // Migrate course progress and related data
    await migrateUserData(supabase, migration.user_id, newUserId, oldProfile.organisation_id)

    // Mark migration as complete
    await supabase
      .from('account_migrations')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('migration_token', migrationToken)

    // Clean up old profile ONLY if we migrated to a different user (Google OAuth)
    // This is the FINAL step after all data has been successfully migrated
    if (useGoogle && migration.user_id !== newUserId) {
      console.log(`Cleaning up old profile for user ${migration.user_id} after successful migration to ${newUserId}`)
      
      // First, verify that no critical data remains linked to the old user
      const { data: remainingData } = await supabase
        .from('base_classes')
        .select('id')
        .eq('user_id', migration.user_id)
        .limit(1)
      
      if (!remainingData || remainingData.length === 0) {
        // Safe to delete the old profile
        const { error: deleteProfileError } = await supabase
          .from('profiles')
          .delete()
          .eq('user_id', migration.user_id)
        
        if (deleteProfileError) {
          console.error('Failed to delete old profile:', deleteProfileError)
          // Don't fail the migration, just log the error
        } else {
          console.log(`Successfully deleted old profile for user ${migration.user_id}`)
        }
        
        // Also delete the old auth user if it exists
        try {
          await supabase.auth.admin.deleteUser(migration.user_id)
          console.log(`Successfully deleted old auth user ${migration.user_id}`)
        } catch (authDeleteError) {
          console.error('Failed to delete old auth user:', authDeleteError)
          // Don't fail the migration, just log the error
        }
      } else {
        console.warn(`Old profile ${migration.user_id} still has data references, skipping deletion`)
      }
    }

    // Clear migration cookie
    const cookieStore = await cookies()
    cookieStore.delete('migration_token')

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      redirectTo: getRedirectPath(oldProfile.role)
    })
  } catch (error) {
    console.error('Migration completion error:', error)
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 })
  }
}

async function migrateUserData(supabase: any, oldUserId: string, newUserId: string, organisationId: string) {
  // This function migrates ALL user data from old user to new user (for Google OAuth)
  // For email/password migration, oldUserId === newUserId, so no data migration needed
  
  if (oldUserId === newUserId) {
    console.log(`No data migration needed - same user ID: ${oldUserId}`)
    return
  }

  console.log(`Migrating ALL data from ${oldUserId} to ${newUserId}`)

  // === CORE LEARNING CONTENT ===
  
  // Migrate base classes (courses created by teacher)
  // Also handle cases where user_id might be NULL but belongs to the organization
  await supabase
    .from('base_classes')
    .update({ user_id: newUserId })
    .eq('user_id', oldUserId)
  
  // Also claim any base_classes with NULL user_id in the same organization
  // (these might be legacy classes created before user tracking)
  await supabase
    .from('base_classes')
    .update({ user_id: newUserId })
    .eq('organisation_id', organisationId)
    .is('user_id', null)

  // Migrate paths (created by teacher)
  await supabase
    .from('paths')
    .update({ creator_user_id: newUserId })
    .eq('creator_user_id', oldUserId)

  // Migrate lessons (created by teacher)
  await supabase
    .from('lessons')
    .update({ creator_user_id: newUserId })
    .eq('creator_user_id', oldUserId)

  // Migrate lesson sections (created by teacher)
  await supabase
    .from('lesson_section_versions')
    .update({ creator_user_id: newUserId })
    .eq('creator_user_id', oldUserId)

  // === CLASS MANAGEMENT ===

  // Class instances don't have teacher_id column - they're linked via base_classes
  // No migration needed for class_instances table

  // Migrate rosters (student enrollments)
  await supabase
    .from('rosters')
    .update({ profile_id: newUserId })
    .eq('profile_id', oldUserId)

  // === PROGRESS TRACKING ===

  // Migrate general progress tracking
  await supabase
    .from('progress')
    .update({ user_id: newUserId })
    .eq('user_id', oldUserId)

  // === ASSESSMENTS & GRADING ===

  // Migrate assessments (created by teacher)
  await supabase
    .from('assessments')
    .update({ created_by: newUserId })
    .eq('created_by', oldUserId)

  // Migrate student attempts
  await supabase
    .from('student_attempts')
    .update({ student_id: newUserId })
    .eq('student_id', oldUserId)

  // Migrate manual grading by teacher
  await supabase
    .from('student_attempts')
    .update({ manually_graded_by: newUserId })
    .eq('manually_graded_by', oldUserId)

  // Migrate student responses
  await supabase
    .from('student_responses')
    .update({ manually_graded_by: newUserId })
    .eq('manually_graded_by', oldUserId)

  // Migrate assignments (created by teacher)
  await supabase
    .from('assignments')
    .update({ created_by: newUserId })
    .eq('created_by', oldUserId)

  // Migrate grades (as student)
  await supabase
    .from('grades')
    .update({ student_id: newUserId })
    .eq('student_id', oldUserId)

  // Migrate grades (as grader/teacher)
  await supabase
    .from('grades')
    .update({ graded_by: newUserId })
    .eq('graded_by', oldUserId)

  // Migrate standards (created by teacher)
  await supabase
    .from('standards')
    .update({ created_by: newUserId })
    .eq('created_by', oldUserId)

  // === DOCUMENTS & MEDIA ===

  // Migrate documents
  await supabase
    .from('documents')
    .update({ uploaded_by: newUserId })
    .eq('uploaded_by', oldUserId)

  // Migrate lesson media assets
  await supabase
    .from('lesson_media_assets')
    .update({ created_by: newUserId })
    .eq('created_by', oldUserId)

  // Migrate base class media assets
  await supabase
    .from('base_class_media_assets')
    .update({ created_by: newUserId })
    .eq('created_by', oldUserId)

  // === COURSE GENERATION ===

  // Migrate course outlines
  await supabase
    .from('course_outlines')
    .update({ user_id: newUserId })
    .eq('user_id', oldUserId)

  // Migrate course generation jobs
  await supabase
    .from('course_generation_jobs')
    .update({ user_id: newUserId })
    .eq('user_id', oldUserId)

  // Migrate generated lesson content
  await supabase
    .from('generated_lesson_content')
    .update({ user_id: newUserId })
    .eq('user_id', oldUserId)

  // Migrate knowledge base analyses
  await supabase
    .from('knowledge_base_analyses')
    .update({ user_id: newUserId })
    .eq('user_id', oldUserId)

  // Migrate course generation rate limits
  await supabase
    .from('course_generation_rate_limits')
    .update({ user_id: newUserId })
    .eq('user_id', oldUserId)

  // === STUDENT STUDY TOOLS ===

  // Migrate study spaces
  await supabase
    .from('study_spaces')
    .update({ user_id: newUserId })
    .eq('user_id', oldUserId)

  // Migrate study notes
  await supabase
    .from('study_notes')
    .update({ user_id: newUserId })
    .eq('user_id', oldUserId)

  // Migrate bookmarks
  await supabase
    .from('bookmarks')
    .update({ user_id: newUserId })
    .eq('user_id', oldUserId)

  // Migrate mind maps
  await supabase
    .from('mind_maps')
    .update({ user_id: newUserId })
    .eq('user_id', oldUserId)

  // Migrate flashcard sets
  await supabase
    .from('flashcard_sets')
    .update({ user_id: newUserId })
    .eq('user_id', oldUserId)

  // Migrate flashcards
  await supabase
    .from('flashcards')
    .update({ user_id: newUserId })
    .eq('user_id', oldUserId)

  // Migrate study goals
  await supabase
    .from('study_goals')
    .update({ user_id: newUserId })
    .eq('user_id', oldUserId)

  // Migrate study sessions
  await supabase
    .from('study_sessions')
    .update({ user_id: newUserId })
    .eq('user_id', oldUserId)

  // Migrate study space brainbytes
  await supabase
    .from('study_space_brainbytes')
    .update({ user_id: newUserId })
    .eq('user_id', oldUserId)

  // === AI & ANALYTICS ===

  // Migrate generations
  await supabase
    .from('generations')
    .update({ user_id: newUserId })
    .eq('user_id', oldUserId)

  // Migrate AI insights
  await supabase
    .from('ai_insights')
    .update({ user_id: newUserId })
    .eq('user_id', oldUserId)

  // Migrate agent analytics
  await supabase
    .from('agent_analytics')
    .update({ user_id: newUserId })
    .eq('user_id', oldUserId)

  // Migrate agent sessions
  await supabase
    .from('agent_sessions')
    .update({ user_id: newUserId })
    .eq('user_id', oldUserId)

  // Migrate agent messages
  await supabase
    .from('agent_messages')
    .update({ user_id: newUserId })
    .eq('user_id', oldUserId)

  // Migrate agent tool usage
  await supabase
    .from('agent_tool_usage')
    .update({ user_id: newUserId })
    .eq('user_id', oldUserId)

  // Migrate Luna conversations
  await supabase
    .from('luna_conversations')
    .update({ user_id: newUserId })
    .eq('user_id', oldUserId)

  // === TEACHER TOOLS ===

  // Migrate teacher tool creations
  await supabase
    .from('teacher_tool_creations')
    .update({ user_id: newUserId })
    .eq('user_id', oldUserId)

  // === FEEDBACK & SUPPORT ===

  // Migrate feedback/support tickets
  await supabase
    .from('feedback_support')
    .update({ user_id: newUserId })
    .eq('user_id', oldUserId)

  // Migrate feedback assigned to admin
  await supabase
    .from('feedback_support')
    .update({ assigned_to: newUserId })
    .eq('assigned_to', oldUserId)

  // === SURVEYS ===

  // Migrate survey responses
  await supabase
    .from('survey_responses')
    .update({ user_id: newUserId })
    .eq('user_id', oldUserId)

  // === VIDEO GUIDES ===

  // Migrate video guides (created by)
  await supabase
    .from('video_guides')
    .update({ created_by: newUserId })
    .eq('created_by', oldUserId)

  // === ADMIN MESSAGES ===

  // Migrate admin messages (from admin)
  await supabase
    .from('admin_messages')
    .update({ from_admin_id: newUserId })
    .eq('from_admin_id', oldUserId)

  // Migrate admin messages (to user)
  await supabase
    .from('admin_messages')
    .update({ to_user_id: newUserId })
    .eq('to_user_id', oldUserId)

  // === FAMILY RELATIONSHIPS ===

  // Update homeschool family info (primary parent)
  await supabase
    .from('homeschool_family_info')
    .update({ primary_parent_id: newUserId })
    .eq('primary_parent_id', oldUserId)

  // Update family students (created by)
  await supabase
    .from('family_students')
    .update({ created_by: newUserId })
    .eq('created_by', oldUserId)

  // Update family students (student_id)
  await supabase
    .from('family_students')
    .update({ student_id: newUserId })
    .eq('student_id', oldUserId)

  // Update profiles (parent_account_id for sub-accounts)
  await supabase
    .from('profiles')
    .update({ parent_account_id: newUserId })
    .eq('parent_account_id', oldUserId)

  // Log migration for audit purposes
  console.log(`COMPLETE data migration finished from user ${oldUserId} to ${newUserId} in organization ${organisationId}`)
}

function getRedirectPath(role: string): string {
  switch (role?.toUpperCase()) {
    case 'STUDENT':
      return '/learn'
    case 'TEACHER':
      return '/teach'
    case 'ADMIN':
      return '/school'
    case 'SUPER_ADMIN':
      return '/org'
    default:
      return '/dashboard'
  }
}
