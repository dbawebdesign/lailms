import { createClient } from '@/lib/supabase/client'
import { Database, Tables } from '../../../packages/types/db'

// Type definitions for gradebook entities
type Assignment = Tables<'assignments'>
type AssignmentInsert = Database['public']['Tables']['assignments']['Insert']
type AssignmentUpdate = Database['public']['Tables']['assignments']['Update']

type Grade = Tables<'grades'>
type GradeInsert = Database['public']['Tables']['grades']['Insert']
type GradeUpdate = Database['public']['Tables']['grades']['Update']

type GradebookSettings = Tables<'gradebook_settings'>
type GradebookSettingsInsert = Database['public']['Tables']['gradebook_settings']['Insert']
type GradebookSettingsUpdate = Database['public']['Tables']['gradebook_settings']['Update']

type Standard = Tables<'standards'>
type StandardInsert = Database['public']['Tables']['standards']['Insert']
type StandardUpdate = Database['public']['Tables']['standards']['Update']

type AssignmentStandard = Tables<'assignment_standards'>
type AssignmentStandardInsert = Database['public']['Tables']['assignment_standards']['Insert']

type Roster = Tables<'rosters'>
type Profile = Tables<'profiles'>
type ClassInstance = Tables<'class_instances'>

const supabase = createClient()

// ============================================================================
// ASSIGNMENT OPERATIONS
// ============================================================================

export const assignmentService = {
  // Get all assignments for a class instance
  async getAssignmentsByClassInstance(classInstanceId: string): Promise<Assignment[]> {
    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .eq('class_instance_id', classInstanceId)
      .order('order_index', { ascending: true })
      .order('due_date', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
  },

  // Get a single assignment by ID
  async getAssignmentById(id: string): Promise<Assignment | null> {
    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  // Create a new assignment
  async createAssignment(assignment: AssignmentInsert): Promise<Assignment> {
    const { data, error } = await supabase
      .from('assignments')
      .insert(assignment)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Update an assignment
  async updateAssignment(id: string, updates: AssignmentUpdate): Promise<Assignment> {
    const { data, error } = await supabase
      .from('assignments')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Delete an assignment
  async deleteAssignment(id: string): Promise<void> {
    const { error } = await supabase
      .from('assignments')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  // Get assignments with standards
  async getAssignmentsWithStandards(classInstanceId: string) {
    const { data, error } = await supabase
      .from('assignments')
      .select(`
        *,
        assignment_standards (
          standard_id,
          standards (*)
        )
      `)
      .eq('class_instance_id', classInstanceId)
      .order('order_index', { ascending: true })
      .order('due_date', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
  },

  // Reorder assignments by updating their order_index
  async reorderAssignments(assignmentId: string, newOrderIndex: number, classInstanceId: string): Promise<void> {
    // Get all assignments for this class instance
    const { data: assignments, error: fetchError } = await supabase
      .from('assignments')
      .select('id, order_index')
      .eq('class_instance_id', classInstanceId)
      .order('order_index', { ascending: true })

    if (fetchError) throw fetchError
    if (!assignments || assignments.length === 0) throw new Error('No assignments found')

    // Find the assignment being moved
    const movingAssignment = assignments.find(a => a.id === assignmentId)
    if (!movingAssignment) throw new Error('Assignment not found')

    // Get the current index of the moving assignment
    const currentIndex = assignments.findIndex(a => a.id === assignmentId)
    
    // Create a copy of the assignments array for reordering
    const reorderedAssignments = [...assignments]
    
    // Remove the assignment from its current position
    reorderedAssignments.splice(currentIndex, 1)
    
    // Insert it at the new position
    reorderedAssignments.splice(newOrderIndex, 0, movingAssignment)

    // Update order_index for each assignment based on its new position
    const updatePromises = reorderedAssignments.map(async (assignment, index) => {
      // Only update if the order_index has actually changed
      if (assignment.order_index !== index) {
        const { error } = await supabase
          .from('assignments')
          .update({ order_index: index })
          .eq('id', assignment.id)
        
        if (error) throw error
      }
    })

    // Execute all updates
    await Promise.all(updatePromises)
  }
}

// ============================================================================
// GRADE OPERATIONS
// ============================================================================

export const gradeService = {
  // Get all grades for a class instance
  async getGradesByClassInstance(classInstanceId: string): Promise<Grade[]> {
    const { data, error } = await supabase
      .from('grades')
      .select('*')
      .eq('class_instance_id', classInstanceId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  // Get grades for a specific student
  async getGradesByStudent(studentId: string, classInstanceId?: string): Promise<Grade[]> {
    let query = supabase
      .from('grades')
      .select('*')
      .eq('student_id', studentId)

    if (classInstanceId) {
      query = query.eq('class_instance_id', classInstanceId)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  // Get grades for a specific assignment
  async getGradesByAssignment(assignmentId: string): Promise<Grade[]> {
    const { data, error } = await supabase
      .from('grades')
      .select('*')
      .eq('assignment_id', assignmentId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  // Get a specific grade
  async getGrade(studentId: string, assignmentId: string): Promise<Grade | null> {
    const { data, error } = await supabase
      .from('grades')
      .select('*')
      .eq('student_id', studentId)
      .eq('assignment_id', assignmentId)
      .single()

    if (error) throw error
    return data
  },

  // Create or update a grade
  async upsertGrade(grade: GradeInsert): Promise<Grade> {
    const { data, error } = await supabase
      .from('grades')
      .upsert(grade, { 
        onConflict: 'student_id,assignment_id',
        ignoreDuplicates: false 
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Update a grade
  async updateGrade(id: string, updates: GradeUpdate): Promise<Grade> {
    const { data, error } = await supabase
      .from('grades')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Delete a grade
  async deleteGrade(id: string): Promise<void> {
    const { error } = await supabase
      .from('grades')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  // Get comprehensive gradebook data for a class
  async getGradebookData(classInstanceId: string) {
    const { data, error } = await supabase
      .from('grades')
      .select(`
        *,
        assignments (*),
        profiles!grades_student_id_fkey (
          user_id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('class_instance_id', classInstanceId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }
}

// ============================================================================
// GRADEBOOK SETTINGS OPERATIONS
// ============================================================================

export const gradebookSettingsService = {
  // Get gradebook settings for a class instance
  async getGradebookSettings(classInstanceId: string): Promise<GradebookSettings | null> {
    const { data, error } = await supabase
      .from('gradebook_settings')
      .select('*')
      .eq('class_instance_id', classInstanceId)
      .single()

    if (error) throw error
    return data
  },

  // Create or update gradebook settings
  async upsertGradebookSettings(settings: GradebookSettingsInsert): Promise<GradebookSettings> {
    const { data, error } = await supabase
      .from('gradebook_settings')
      .upsert(settings, { 
        onConflict: 'class_instance_id',
        ignoreDuplicates: false 
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Update gradebook settings
  async updateGradebookSettings(id: string, updates: GradebookSettingsUpdate): Promise<GradebookSettings> {
    const { data, error } = await supabase
      .from('gradebook_settings')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }
}

// ============================================================================
// STANDARDS OPERATIONS
// ============================================================================

export const standardsService = {
  // Get standards for an organization
  async getStandardsByOrganization(organisationId: string): Promise<Standard[]> {
    const { data, error } = await supabase
      .from('standards')
      .select('*')
      .eq('organisation_id', organisationId)
      .order('category', { ascending: true })
      .order('name', { ascending: true })

    if (error) throw error
    return data || []
  },

  // Create a new standard
  async createStandard(standard: StandardInsert): Promise<Standard> {
    const { data, error } = await supabase
      .from('standards')
      .insert(standard)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Update a standard
  async updateStandard(id: string, updates: StandardUpdate): Promise<Standard> {
    const { data, error } = await supabase
      .from('standards')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Delete a standard
  async deleteStandard(id: string): Promise<void> {
    const { error } = await supabase
      .from('standards')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  // Link assignment to standards
  async linkAssignmentToStandards(assignmentId: string, standardIds: string[]): Promise<void> {
    // First remove existing links
    await supabase
      .from('assignment_standards')
      .delete()
      .eq('assignment_id', assignmentId)

    // Then add new links
    if (standardIds.length > 0) {
      const links: AssignmentStandardInsert[] = standardIds.map(standardId => ({
        assignment_id: assignmentId,
        standard_id: standardId
      }))

      const { error } = await supabase
        .from('assignment_standards')
        .insert(links)

      if (error) throw error
    }
  }
}

// ============================================================================
// STUDENT/ROSTER OPERATIONS
// ============================================================================

export const studentService = {
  // Get students enrolled in a class instance
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
          avatar_url
        )
      `)
      .eq('class_instance_id', classInstanceId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
  },

  // Get comprehensive student data with grades
  async getStudentsWithGrades(classInstanceId: string) {
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
        ),
        grades!grades_student_id_fkey (
          *,
          assignments (*)
        )
      `)
      .eq('class_instance_id', classInstanceId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
  }
}

// ============================================================================
// COMPREHENSIVE GRADEBOOK OPERATIONS
// ============================================================================

export const gradebookService = {
  // Get complete gradebook data for a class instance
  async getCompleteGradebook(classInstanceId: string) {
    try {
      const [assignments, students, grades, settings] = await Promise.all([
        assignmentService.getAssignmentsWithStandards(classInstanceId),
        studentService.getStudentsByClassInstance(classInstanceId),
        gradeService.getGradesByClassInstance(classInstanceId),
        gradebookSettingsService.getGradebookSettings(classInstanceId)
      ])

      return {
        assignments,
        students,
        grades,
        settings
      }
    } catch (error) {
      console.error('Error fetching complete gradebook:', error)
      throw error
    }
  },

  // Initialize gradebook for a new class instance
  async initializeGradebook(classInstanceId: string, defaultSettings: any = {}) {
    const settings: GradebookSettingsInsert = {
      class_instance_id: classInstanceId,
      settings: {
        grading_scale: 'percentage',
        show_points: true,
        show_percentages: true,
        allow_late_submissions: true,
        late_penalty: 0,
        ...defaultSettings
      }
    }

    return await gradebookSettingsService.upsertGradebookSettings(settings)
  },

  // Calculate class statistics
  async getClassStatistics(classInstanceId: string) {
    const { data, error } = await supabase
      .from('grades')
      .select('points_earned, percentage, status')
      .eq('class_instance_id', classInstanceId)
      .eq('status', 'graded')

    if (error) throw error

    const grades = data || []
    const validGrades = grades.filter(g => g.percentage !== null)
    
    if (validGrades.length === 0) {
      return {
        average: 0,
        median: 0,
        highest: 0,
        lowest: 0,
        totalGraded: 0,
        totalMissing: grades.filter(g => g.status === 'missing').length
      }
    }

    const percentages = validGrades.map(g => g.percentage!).sort((a, b) => a - b)
    const sum = percentages.reduce((acc, curr) => acc + curr, 0)
    const average = sum / percentages.length
    const median = percentages.length % 2 === 0 
      ? (percentages[percentages.length / 2 - 1] + percentages[percentages.length / 2]) / 2
      : percentages[Math.floor(percentages.length / 2)]

    return {
      average: Math.round(average * 100) / 100,
      median: Math.round(median * 100) / 100,
      highest: Math.max(...percentages),
      lowest: Math.min(...percentages),
      totalGraded: validGrades.length,
      totalMissing: grades.filter(g => g.status === 'missing').length
    }
  }
} 