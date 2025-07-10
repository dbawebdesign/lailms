import { createClient } from '@/lib/supabase/client'
import { Database, Tables } from '../../../packages/types/db'

// Type definitions
type ClassInstance = Tables<'class_instances'>
type ClassInstanceInsert = Database['public']['Tables']['class_instances']['Insert']
type ClassInstanceUpdate = Database['public']['Tables']['class_instances']['Update']

type BaseClass = Tables<'base_classes'>
type Roster = Tables<'rosters'>
type Profile = Tables<'profiles'>

const supabase = createClient()

// ============================================================================
// CLASS INSTANCE OPERATIONS
// ============================================================================

export const classInstanceService = {
  // Get all class instances for a user (teacher)
  async getClassInstancesByTeacher(teacherId: string): Promise<ClassInstance[]> {
    const { data, error } = await supabase
      .from('class_instances')
      .select(`
        *,
        base_classes!inner (
          id,
          name,
          description,
          user_id
        )
      `)
      .eq('base_classes.user_id', teacherId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  // Get all class instances for a student
  async getClassInstancesByStudent(studentId: string): Promise<ClassInstance[]> {
    const { data, error } = await supabase
      .from('rosters')
      .select(`
        class_instances (
          id,
          base_class_id,
          name,
          start_date,
          end_date,
          status,
          enrollment_code,
          settings,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', studentId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data?.map(item => item.class_instances).filter(Boolean).flat() || []
  },

  // Get a single class instance by ID
  async getClassInstanceById(id: string): Promise<ClassInstance | null> {
    const { data, error } = await supabase
      .from('class_instances')
      .select(`
        *,
        base_classes (
          id,
          name,
          description,
          user_id,
          organisation_id
        )
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  // Create a new class instance
  async createClassInstance(classInstance: ClassInstanceInsert): Promise<ClassInstance> {
    const { data, error } = await supabase
      .from('class_instances')
      .insert(classInstance)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Update a class instance
  async updateClassInstance(id: string, updates: ClassInstanceUpdate): Promise<ClassInstance> {
    const { data, error } = await supabase
      .from('class_instances')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Delete a class instance
  async deleteClassInstance(id: string): Promise<void> {
    const { error } = await supabase
      .from('class_instances')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  // Get class instance with full details (students, assignments, etc.)
  async getClassInstanceWithDetails(id: string) {
    const { data, error } = await supabase
      .from('class_instances')
      .select(`
        *,
        base_classes (
          id,
          name,
          description,
          user_id,
          organisation_id
        ),
        rosters (
          id,
          user_id,
          enrolled_at,
          profiles!rosters_user_id_fkey (
            user_id,
            first_name,
            last_name,
            email,
            avatar_url
          )
        ),
        assignments (
          id,
          name,
          description,
          type,
          points_possible,
          due_date,
          published,
          created_at
        ),
        gradebook_settings (
          id,
          settings
        )
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  // Get enrollment statistics for a class instance
  async getEnrollmentStats(id: string) {
    const { data, error } = await supabase
      .from('rosters')
      .select('user_id, enrolled_at')
      .eq('class_instance_id', id)

    if (error) throw error

    const enrollments = data || []
    const totalStudents = enrollments.length
    const recentEnrollments = enrollments.filter(
      enrollment => {
        const enrolledDate = new Date(enrollment.enrolled_at)
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        return enrolledDate >= weekAgo
      }
    ).length

    return {
      totalStudents,
      recentEnrollments
    }
  }
}

// ============================================================================
// ROSTER OPERATIONS
// ============================================================================

export const rosterService = {
  // Get all students in a class instance
  async getStudentsByClassInstance(classInstanceId: string) {
    const { data, error } = await supabase
      .from('rosters')
      .select(`
        *,
        profiles!rosters_user_id_fkey (
          user_id,
          first_name,
          last_name,
          email,
          avatar_url,
          role
        )
      `)
      .eq('class_instance_id', classInstanceId)
      .order('enrolled_at', { ascending: true })

    if (error) throw error
    return data || []
  },

  // Add a student to a class instance
  async addStudentToClass(classInstanceId: string, userId: string) {
    const { data, error } = await supabase
      .from('rosters')
      .insert({
        class_instance_id: classInstanceId,
        user_id: userId,
        enrolled_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Remove a student from a class instance
  async removeStudentFromClass(classInstanceId: string, userId: string) {
    const { error } = await supabase
      .from('rosters')
      .delete()
      .eq('class_instance_id', classInstanceId)
      .eq('user_id', userId)

    if (error) throw error
  },

  // Check if a user is enrolled in a class instance
  async isStudentEnrolled(classInstanceId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('rosters')
      .select('id')
      .eq('class_instance_id', classInstanceId)
      .eq('user_id', userId)
      .single()

    if (error) return false
    return !!data
  },

  // Get roster entry for a specific student
  async getRosterEntry(classInstanceId: string, userId: string) {
    const { data, error } = await supabase
      .from('rosters')
      .select(`
        *,
        profiles!rosters_user_id_fkey (
          user_id,
          first_name,
          last_name,
          email,
          avatar_url
        )
      `)
      .eq('class_instance_id', classInstanceId)
      .eq('user_id', userId)
      .single()

    if (error) throw error
    return data
  }
}

// ============================================================================
// ENROLLMENT OPERATIONS
// ============================================================================

export const enrollmentService = {
  // Enroll student by enrollment code
  async enrollByCode(enrollmentCode: string, userId: string) {
    // First, find the class instance by enrollment code
    const { data: classInstance, error: classError } = await supabase
      .from('class_instances')
      .select('id, name, status')
      .eq('enrollment_code', enrollmentCode)
      .single()

    if (classError) throw new Error('Invalid enrollment code')
    if (!classInstance) throw new Error('Class not found')
    if (classInstance.status !== 'active') throw new Error('Class is not active')

    // Check if student is already enrolled
    const isAlreadyEnrolled = await rosterService.isStudentEnrolled(classInstance.id, userId)
    if (isAlreadyEnrolled) {
      throw new Error('Student is already enrolled in this class')
    }

    // Enroll the student
    const roster = await rosterService.addStudentToClass(classInstance.id, userId)

    return {
      success: true,
      message: `Successfully enrolled in ${classInstance.name}`,
      classInstanceId: classInstance.id,
      classInstanceName: classInstance.name,
      enrollmentId: roster.id
    }
  },

  // Generate new enrollment code
  async generateEnrollmentCode(classInstanceId: string): Promise<string> {
    const enrollmentCode = Math.random().toString(36).substring(2, 8).toUpperCase()
    
    await classInstanceService.updateClassInstance(classInstanceId, {
      enrollment_code: enrollmentCode
    })

    return enrollmentCode
  },

  // Get enrollment code for a class instance
  async getEnrollmentCode(classInstanceId: string): Promise<string | null> {
    const classInstance = await classInstanceService.getClassInstanceById(classInstanceId)
    return classInstance?.enrollment_code || null
  }
}

// ============================================================================
// COMPREHENSIVE CLASS OPERATIONS
// ============================================================================

export const classService = {
  // Get complete class data for dashboard
  async getCompleteClassData(classInstanceId: string) {
    try {
      const [classInstance, students, assignments, gradebookSettings] = await Promise.all([
        classInstanceService.getClassInstanceById(classInstanceId),
        rosterService.getStudentsByClassInstance(classInstanceId),
        supabase.from('assignments').select('*').eq('class_instance_id', classInstanceId),
        supabase.from('gradebook_settings').select('*').eq('class_instance_id', classInstanceId).single()
      ])

      return {
        classInstance,
        students,
        assignments: assignments.data || [],
        gradebookSettings: gradebookSettings.data || null
      }
    } catch (error) {
      console.error('Error fetching complete class data:', error)
      throw error
    }
  },

  // Get class summary statistics
  async getClassSummary(classInstanceId: string) {
    const [enrollmentStats, assignmentCount, recentActivity] = await Promise.all([
      classInstanceService.getEnrollmentStats(classInstanceId),
      supabase.from('assignments').select('id').eq('class_instance_id', classInstanceId),
      supabase.from('grades').select('created_at').eq('class_instance_id', classInstanceId).order('created_at', { ascending: false }).limit(5)
    ])

    return {
      totalStudents: enrollmentStats.totalStudents,
      recentEnrollments: enrollmentStats.recentEnrollments,
      totalAssignments: assignmentCount.data?.length || 0,
      recentActivity: recentActivity.data || []
    }
  },

  // Get classes for user based on role
  async getClassesForUser(userId: string, role: 'teacher' | 'student') {
    if (role === 'teacher') {
      return await classInstanceService.getClassInstancesByTeacher(userId)
    } else {
      return await classInstanceService.getClassInstancesByStudent(userId)
    }
  }
} 