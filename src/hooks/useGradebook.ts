import { useState, useEffect, useCallback } from 'react'
import { 
  gradebookService, 
  assignmentService, 
  gradeService, 
  studentService,
  gradebookSettingsService,
  standardsService
} from '@/lib/services/gradebook'
import { Database, Tables } from '../../packages/types/db'

// Type definitions
type Assignment = Tables<'assignments'>
type Grade = Tables<'grades'>
type GradebookSettings = Tables<'gradebook_settings'>
type Standard = Tables<'standards'>

export interface GradebookData {
  students: Array<{
    id: string
    name: string
    email: string
    avatar_url?: string
    overall_grade: number
    grade_letter: string
    missing_assignments: number
    late_assignments: number
    mastery_level: 'below' | 'approaching' | 'proficient' | 'advanced'
  }>
  assignments: Assignment[]
  grades: Record<string, Grade>
  standards: Standard[]
  settings: GradebookSettings | null
}

export interface UseGradebookReturn {
  data: GradebookData
  isLoading: boolean
  error: string | null
  syncStatus: 'synced' | 'syncing' | 'error'
  refresh: () => Promise<void>
  updateGrade: (studentId: string, assignmentId: string, gradeData: Partial<Grade>) => Promise<void>
  createAssignment: (assignmentData: Partial<Assignment>) => Promise<void>
  updateAssignment: (assignmentId: string, updates: Partial<Assignment>) => Promise<void>
  deleteAssignment: (assignmentId: string) => Promise<void>
  updateSettings: (settings: any) => Promise<void>
}

export function useGradebook(classInstanceId: string): UseGradebookReturn {
  const [data, setData] = useState<GradebookData>({
    students: [],
    assignments: [],
    grades: {},
    standards: [],
    settings: null
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced')

  // Helper function to calculate grade statistics
  const calculateGradeStatistics = useCallback((studentId: string, grades: Grade[], assignments: Assignment[]) => {
    const studentGrades = grades.filter(g => g.student_id === studentId && g.status === 'graded')
    
    if (studentGrades.length === 0) {
      return {
        overall_grade: 0,
        grade_letter: 'N/A',
        missing_assignments: assignments.length,
        late_assignments: 0,
        mastery_level: 'below' as const
      }
    }

    // Calculate overall grade as weighted average
    const totalPoints = studentGrades.reduce((sum, grade) => sum + (grade.points_earned || 0), 0)
    const totalPossible = studentGrades.reduce((sum, grade) => {
      const assignment = assignments.find(a => a.id === grade.assignment_id)
      return sum + (assignment?.points_possible || 0)
    }, 0)

    const overallPercentage = totalPossible > 0 ? (totalPoints / totalPossible) * 100 : 0
    
    // Calculate grade letter
    let gradeLetter = 'F'
    if (overallPercentage >= 97) gradeLetter = 'A+'
    else if (overallPercentage >= 93) gradeLetter = 'A'
    else if (overallPercentage >= 90) gradeLetter = 'A-'
    else if (overallPercentage >= 87) gradeLetter = 'B+'
    else if (overallPercentage >= 83) gradeLetter = 'B'
    else if (overallPercentage >= 80) gradeLetter = 'B-'
    else if (overallPercentage >= 77) gradeLetter = 'C+'
    else if (overallPercentage >= 73) gradeLetter = 'C'
    else if (overallPercentage >= 70) gradeLetter = 'C-'
    else if (overallPercentage >= 67) gradeLetter = 'D+'
    else if (overallPercentage >= 63) gradeLetter = 'D'
    else if (overallPercentage >= 60) gradeLetter = 'D-'

    // Calculate missing and late assignments
    const missingAssignments = grades.filter(g => g.student_id === studentId && g.status === 'missing').length
    const lateAssignments = grades.filter(g => g.student_id === studentId && g.status === 'late').length

    // Determine mastery level
    let masteryLevel: 'below' | 'approaching' | 'proficient' | 'advanced' = 'below'
    if (overallPercentage >= 90) masteryLevel = 'advanced'
    else if (overallPercentage >= 80) masteryLevel = 'proficient'
    else if (overallPercentage >= 70) masteryLevel = 'approaching'

    return {
      overall_grade: Math.round(overallPercentage * 100) / 100,
      grade_letter: gradeLetter,
      missing_assignments: missingAssignments,
      late_assignments: lateAssignments,
      mastery_level: masteryLevel
    }
  }, [])

  // Load gradebook data
  const loadGradebookData = useCallback(async () => {
    if (!classInstanceId) return

    setIsLoading(true)
    setSyncStatus('syncing')
    setError(null)

    try {
      const result = await gradebookService.getCompleteGradebook(classInstanceId)
      
      // Transform students data with calculated statistics
      const studentsWithStats = result.students.map(student => {
        const profile = student.profiles
        const stats = calculateGradeStatistics(student.user_id, result.grades, result.assignments)
        
        return {
          id: student.user_id,
          name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Unknown Student',
          email: profile?.email || '',
          avatar_url: profile?.avatar_url || undefined,
          ...stats
        }
      })

      // Transform grades into a record for easy lookup
      const gradesRecord = result.grades.reduce((acc, grade) => {
        const key = `${grade.student_id}-${grade.assignment_id}`
        acc[key] = grade
        return acc
      }, {} as Record<string, Grade>)

      setData({
        students: studentsWithStats,
        assignments: result.assignments,
        grades: gradesRecord,
        standards: [], // Will be populated when standards are linked
        settings: result.settings
      })

      setSyncStatus('synced')
    } catch (err) {
      console.error('Error loading gradebook data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load gradebook data')
      setSyncStatus('error')
    } finally {
      setIsLoading(false)
    }
  }, [classInstanceId, calculateGradeStatistics])

  // Refresh data
  const refresh = useCallback(async () => {
    await loadGradebookData()
  }, [loadGradebookData])

  // Update a grade
  const updateGrade = useCallback(async (studentId: string, assignmentId: string, gradeData: Partial<Grade>) => {
    try {
      setSyncStatus('syncing')
      
      const gradeUpdate = {
        student_id: studentId,
        assignment_id: assignmentId,
        class_instance_id: classInstanceId,
        ...gradeData,
        updated_at: new Date().toISOString()
      }

      await gradeService.upsertGrade(gradeUpdate)
      
      // Refresh data to get updated statistics
      await loadGradebookData()
    } catch (err) {
      console.error('Error updating grade:', err)
      setError(err instanceof Error ? err.message : 'Failed to update grade')
      setSyncStatus('error')
    }
  }, [classInstanceId, loadGradebookData])

  // Create a new assignment
  const createAssignment = useCallback(async (assignmentData: Partial<Assignment>) => {
    try {
      setSyncStatus('syncing')
      
      const newAssignment = {
        class_instance_id: classInstanceId,
        name: assignmentData.name || 'New Assignment',
        points_possible: assignmentData.points_possible || 100,
        type: assignmentData.type || 'homework',
        ...assignmentData
      }

      await assignmentService.createAssignment(newAssignment)
      
      // Refresh data
      await loadGradebookData()
    } catch (err) {
      console.error('Error creating assignment:', err)
      setError(err instanceof Error ? err.message : 'Failed to create assignment')
      setSyncStatus('error')
    }
  }, [classInstanceId, loadGradebookData])

  // Update an assignment
  const updateAssignment = useCallback(async (assignmentId: string, updates: Partial<Assignment>) => {
    try {
      setSyncStatus('syncing')
      
      await assignmentService.updateAssignment(assignmentId, updates)
      
      // Refresh data
      await loadGradebookData()
    } catch (err) {
      console.error('Error updating assignment:', err)
      setError(err instanceof Error ? err.message : 'Failed to update assignment')
      setSyncStatus('error')
    }
  }, [loadGradebookData])

  // Delete an assignment
  const deleteAssignment = useCallback(async (assignmentId: string) => {
    try {
      setSyncStatus('syncing')
      
      await assignmentService.deleteAssignment(assignmentId)
      
      // Refresh data
      await loadGradebookData()
    } catch (err) {
      console.error('Error deleting assignment:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete assignment')
      setSyncStatus('error')
    }
  }, [loadGradebookData])

  // Update gradebook settings
  const updateSettings = useCallback(async (settings: any) => {
    try {
      setSyncStatus('syncing')
      
      await gradebookSettingsService.upsertGradebookSettings({
        class_instance_id: classInstanceId,
        settings
      })
      
      // Refresh data
      await loadGradebookData()
    } catch (err) {
      console.error('Error updating settings:', err)
      setError(err instanceof Error ? err.message : 'Failed to update settings')
      setSyncStatus('error')
    }
  }, [classInstanceId, loadGradebookData])

  // Load data on mount and when classInstanceId changes
  useEffect(() => {
    if (classInstanceId) {
      loadGradebookData()
    }
  }, [classInstanceId, loadGradebookData])

  return {
    data,
    isLoading,
    error,
    syncStatus,
    refresh,
    updateGrade,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    updateSettings
  }
} 