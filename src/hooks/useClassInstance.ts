import { useState, useEffect, useCallback } from 'react'
import { 
  classInstanceService, 
  rosterService, 
  enrollmentService,
  classService
} from '@/lib/services/class-instance'
import { Database, Tables } from 'packages/types/db'

// Type definitions
type ClassInstance = Tables<'class_instances'>
type Roster = Tables<'rosters'>
type Profile = Tables<'profiles'>

export interface ClassInstanceData {
  id: string
  name: string
  enrollment_code: string
  start_date?: string
  end_date?: string
  status: string
  settings?: any
  base_class?: {
    id: string
    name: string
    description: string
    user_id: string
    organisation_id: string
  }
  students: Array<{
    id: string
    name: string
    email: string
    avatar_url?: string
    enrolled_at: string
    role: string
  }>
  enrollmentStats: {
    totalStudents: number
    recentEnrollments: number
  }
  summary: {
    totalStudents: number
    totalAssignments: number
    recentActivity: any[]
  }
}

export interface UseClassInstanceReturn {
  data: ClassInstanceData | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  addStudent: (userId: string) => Promise<void>
  removeStudent: (userId: string) => Promise<void>
  updateInstance: (updates: Partial<ClassInstance>) => Promise<void>
  generateEnrollmentCode: () => Promise<string>
  enrollByCode: (code: string, userId: string) => Promise<any>
}

export function useClassInstance(classInstanceId: string): UseClassInstanceReturn {
  const [data, setData] = useState<ClassInstanceData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load class instance data
  const loadClassInstanceData = useCallback(async () => {
    if (!classInstanceId) return

    setIsLoading(true)
    setError(null)

    try {
      const [classInstance, students, summary] = await Promise.all([
        classInstanceService.getClassInstanceById(classInstanceId),
        rosterService.getStudentsByClassInstance(classInstanceId),
        classService.getClassSummary(classInstanceId)
      ])

      if (!classInstance) {
        throw new Error('Class instance not found')
      }

      // Transform students data
      const studentsWithDetails = students.map(student => {
        const profile = student.profiles
        return {
          id: student.user_id,
          name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Unknown Student',
          email: profile?.email || '',
          avatar_url: profile?.avatar_url || undefined,
          enrolled_at: student.enrolled_at,
          role: profile?.role || 'student'
        }
      })

      setData({
        id: classInstance.id,
        name: classInstance.name,
        enrollment_code: classInstance.enrollment_code || '',
        start_date: classInstance.start_date || undefined,
        end_date: classInstance.end_date || undefined,
        status: classInstance.status || 'active',
        settings: classInstance.settings,
        base_class: (classInstance as any).base_classes ? {
          id: (classInstance as any).base_classes.id,
          name: (classInstance as any).base_classes.name,
          description: (classInstance as any).base_classes.description || '',
          user_id: (classInstance as any).base_classes.user_id,
          organisation_id: (classInstance as any).base_classes.organisation_id
        } : undefined,
        students: studentsWithDetails,
        enrollmentStats: {
          totalStudents: summary.totalStudents,
          recentEnrollments: summary.recentEnrollments
        },
        summary
      })
    } catch (err) {
      console.error('Error loading class instance data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load class instance data')
    } finally {
      setIsLoading(false)
    }
  }, [classInstanceId])

  // Refresh data
  const refresh = useCallback(async () => {
    await loadClassInstanceData()
  }, [loadClassInstanceData])

  // Add a student to the class
  const addStudent = useCallback(async (userId: string) => {
    try {
      await rosterService.addStudentToClass(classInstanceId, userId)
      await loadClassInstanceData() // Refresh data
    } catch (err) {
      console.error('Error adding student:', err)
      setError(err instanceof Error ? err.message : 'Failed to add student')
    }
  }, [classInstanceId, loadClassInstanceData])

  // Remove a student from the class
  const removeStudent = useCallback(async (userId: string) => {
    try {
      await rosterService.removeStudentFromClass(classInstanceId, userId)
      await loadClassInstanceData() // Refresh data
    } catch (err) {
      console.error('Error removing student:', err)
      setError(err instanceof Error ? err.message : 'Failed to remove student')
    }
  }, [classInstanceId, loadClassInstanceData])

  // Update class instance
  const updateInstance = useCallback(async (updates: Partial<ClassInstance>) => {
    try {
      await classInstanceService.updateClassInstance(classInstanceId, updates)
      await loadClassInstanceData() // Refresh data
    } catch (err) {
      console.error('Error updating class instance:', err)
      setError(err instanceof Error ? err.message : 'Failed to update class instance')
    }
  }, [classInstanceId, loadClassInstanceData])

  // Generate new enrollment code
  const generateEnrollmentCode = useCallback(async (): Promise<string> => {
    try {
      const code = await enrollmentService.generateEnrollmentCode(classInstanceId)
      await loadClassInstanceData() // Refresh data
      return code
    } catch (err) {
      console.error('Error generating enrollment code:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate enrollment code')
      throw err
    }
  }, [classInstanceId, loadClassInstanceData])

  // Enroll by code
  const enrollByCode = useCallback(async (code: string, userId: string) => {
    try {
      const result = await enrollmentService.enrollByCode(code, userId)
      return result
    } catch (err) {
      console.error('Error enrolling by code:', err)
      setError(err instanceof Error ? err.message : 'Failed to enroll by code')
      throw err
    }
  }, [])

  // Load data on mount and when classInstanceId changes
  useEffect(() => {
    if (classInstanceId) {
      loadClassInstanceData()
    }
  }, [classInstanceId, loadClassInstanceData])

  return {
    data,
    isLoading,
    error,
    refresh,
    addStudent,
    removeStudent,
    updateInstance,
    generateEnrollmentCode,
    enrollByCode
  }
}

// Hook for getting all class instances for a user
export function useClassInstances(userId: string, role: 'teacher' | 'student') {
  const [classes, setClasses] = useState<ClassInstance[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadClasses = useCallback(async () => {
    if (!userId) return

    setIsLoading(true)
    setError(null)

    try {
      const classInstances = await classService.getClassesForUser(userId, role)
      setClasses(classInstances)
    } catch (err) {
      console.error('Error loading class instances:', err)
      setError(err instanceof Error ? err.message : 'Failed to load class instances')
    } finally {
      setIsLoading(false)
    }
  }, [userId, role])

  const refresh = useCallback(async () => {
    await loadClasses()
  }, [loadClasses])

  useEffect(() => {
    if (userId) {
      loadClasses()
    }
  }, [userId, loadClasses])

  return {
    classes,
    isLoading,
    error,
    refresh
  }
} 