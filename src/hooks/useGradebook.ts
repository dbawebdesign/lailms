import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  gradebookService, 
  assignmentService, 
  gradeService, 
  studentService,
  gradebookSettingsService,
  standardsService
} from '@/lib/services/gradebook'
import { Database, Tables } from '../../packages/types/db'
import { createClient } from '@/lib/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'

// Type definitions
type Assignment = Tables<'assignments'>
type Grade = Tables<'grades'>
type GradebookSettings = Tables<'gradebook_settings'>
type Standard = Tables<'standards'>

// Broadcast event types
interface GradeUpdateEvent {
  type: 'grade_updated' | 'grade_created' | 'grade_deleted'
  grade: Grade
  class_instance_id: string
}

interface AssignmentUpdateEvent {
  type: 'assignment_updated' | 'assignment_created' | 'assignment_deleted'
  assignment: Assignment
  class_instance_id: string
}

interface PresenceState {
  user_id: string
  user_name: string
  viewing_at: string
}

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
    completed_assignments: number
    total_assignments: number
  }>
  assignments: Assignment[]
  grades: Record<string, Grade>
  standards: Standard[]
  settings: GradebookSettings | null
  activeViewers: PresenceState[]
}

export interface UseGradebookReturn {
  data: GradebookData
  isLoading: boolean
  error: string | null
  syncStatus: 'synced' | 'syncing' | 'error'
  connectionStatus: 'connected' | 'connecting' | 'disconnected'
  refresh: () => Promise<void>
  updateGrade: (studentId: string, assignmentId: string, gradeData: Partial<Grade>) => Promise<void>
  createAssignment: (assignmentData: Partial<Assignment>) => Promise<void>
  updateAssignment: (assignmentId: string, updates: Partial<Assignment>) => Promise<void>
  deleteAssignment: (assignmentId: string) => Promise<void>
  reorderAssignments: (assignmentId: string, newOrderIndex: number) => Promise<void>
  updateSettings: (settings: any) => Promise<void>
}

export function useGradebook(classInstanceId: string): UseGradebookReturn {
  const [data, setData] = useState<GradebookData>({
    students: [],
    assignments: [],
    grades: {},
    standards: [],
    settings: null,
    activeViewers: []
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced')
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected')
  
  // Real-time subscription refs
  const channelRef = useRef<RealtimeChannel | null>(null)
  const supabaseRef = useRef(createClient())
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Helper function to calculate grade statistics
  const calculateGradeStatistics = useCallback((studentId: string, grades: Grade[], assignments: Assignment[]) => {
    const studentGrades = grades.filter(g => g.student_id === studentId && g.status === 'graded')
    
    if (studentGrades.length === 0) {
      return {
        overall_grade: 0,
        grade_letter: 'N/A',
        missing_assignments: assignments.length,
        late_assignments: 0,
        mastery_level: 'below' as const,
        completed_assignments: 0,
        total_assignments: assignments.length
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

    // Calculate completed and total assignments
    const completedAssignments = grades.filter(g => g.student_id === studentId && g.status === 'graded').length;
    const totalAssignments = assignments.length;

    return {
      overall_grade: Math.round(overallPercentage * 100) / 100,
      grade_letter: gradeLetter,
      missing_assignments: missingAssignments,
      late_assignments: lateAssignments,
      mastery_level: masteryLevel,
      completed_assignments: completedAssignments,
      total_assignments: totalAssignments
    }
  }, [])

  // Helper function to recalculate student statistics
  const recalculateStudentStats = useCallback((students: any[], grades: Grade[], assignments: Assignment[]) => {
    return students.map(student => {
      const stats = calculateGradeStatistics(student.id, grades, assignments)
      return {
        ...student,
        ...stats
      }
    })
  }, [calculateGradeStatistics])

  // Load gradebook data
  const loadGradebookData = useCallback(async () => {
    if (!classInstanceId) return;

    setIsLoading(true);
    setSyncStatus('syncing');
    setError(null);

    try {
      const { data: result, error } = await supabaseRef.current.rpc('get_gradebook_data', {
        p_class_instance_id: classInstanceId,
      });

      if (error) throw error;

      // Transform students data with calculated statistics
      const studentsWithStats = (result.students || []).map((student: any) => {
        const studentGrades = (result.grades || []).filter((g: any) => g.student_id === student.id);
        const stats = calculateGradeStatistics(student.id, studentGrades, result.assignments || []);
        
        return {
          id: student.id,
          name: `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Unknown Student',
          email: student.email || '',
          ...stats
        };
      });

      // Transform grades into a record for easy lookup
      const gradesRecord = (result.grades || []).reduce((acc: any, grade: any) => {
        const key = `${grade.student_id}-${grade.assignment_id}`;
        acc[key] = grade;
        return acc;
      }, {} as Record<string, Grade>);

      console.log('📥 Loading fresh data from database:', {
        assignmentsFromDB: (result.assignments || []).map((a, i) => ({ 
          pos: i, 
          name: a.name, 
          order_index: a.order_index,
          id: a.id 
        }))
      });

      setData(prevData => ({
        ...prevData,
        students: studentsWithStats,
        assignments: result.assignments || [],
        grades: gradesRecord,
        settings: result.settings || null,
      }));

      setSyncStatus('synced');
    } catch (err) {
      console.error('Error loading gradebook data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load gradebook data');
      setSyncStatus('error');
    } finally {
      setIsLoading(false);
    }
  }, [classInstanceId, calculateGradeStatistics]);

  // Set up optimized real-time subscriptions using Broadcast
  const setupRealtimeSubscriptions = useCallback(async () => {
    // This check is critical to prevent re-subscribing if a channel already exists.
    if (!classInstanceId) return;
    
    // Additional safeguard: if a channel somehow exists, clean it up first
    if (channelRef.current) {
      console.warn('Cleaning up existing channel before creating new subscription');
      channelRef.current.unsubscribe();
      supabaseRef.current.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    try {
      setConnectionStatus('connecting');
      const supabase = supabaseRef.current;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel(`gradebook:${classInstanceId}`, {
          config: {
            broadcast: { self: true },
            presence: { key: user.id }
          }
        })
        .on('broadcast', { event: 'grade_update' }, (payload: { payload: GradeUpdateEvent }) => {
          const { type, grade } = payload.payload;
          
          setData(prevData => {
            const key = `${grade.student_id}-${grade.assignment_id}`;
            let updatedGrades = { ...prevData.grades };
            if (type === 'grade_created' || type === 'grade_updated') {
              updatedGrades[key] = grade;
            } else if (type === 'grade_deleted') {
              delete updatedGrades[key];
            }
            const gradesArray = Object.values(updatedGrades);
            const updatedStudents = recalculateStudentStats(prevData.students, gradesArray, prevData.assignments);
            return { ...prevData, grades: updatedGrades, students: updatedStudents };
          });
        })
        .on('presence', { event: 'sync' }, () => {
          if (channelRef.current) {
            const newState = channelRef.current.presenceState<PresenceState>();
            setData(prevData => ({ ...prevData, activeViewers: Object.values(newState).map((v: any) => v[0]) }));
          }
        });
      
      // Store the channel reference BEFORE subscribing to prevent race conditions
      channelRef.current = channel;
      
      // Subscribe to the channel
      channel.subscribe((status, error) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
          // Track presence after successful subscription
          channel.track({ 
            user_id: user.id, 
            user_name: user.email || 'Anonymous', 
            viewing_at: new Date().toISOString() 
          });
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Channel subscription error:', error);
          setConnectionStatus('disconnected');
          // Clear the channel reference on error
          channelRef.current = null;
        } else if (status === 'CLOSED') {
          setConnectionStatus('disconnected');
          // Don't clear the channel reference here - let cleanup handle it
        }
      });
        
    } catch (error) {
      console.error('Error setting up real-time subscriptions:', error);
      setConnectionStatus('disconnected');
      // Clean up on error
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    }
  }, [classInstanceId, recalculateStudentStats]);

  // Load data and setup subscriptions on mount
  useEffect(() => {
    if (classInstanceId) {
      loadGradebookData();
      setupRealtimeSubscriptions();
    }

    // Cleanup function - this is critical for preventing multiple subscriptions
    return () => {
      if (channelRef.current) {
        // Properly unsubscribe and remove the channel
        channelRef.current.unsubscribe();
        supabaseRef.current.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
    // CRITICAL: Only depend on classInstanceId, not the callback functions
    // This prevents re-running when callbacks change due to re-renders
  }, [classInstanceId]);

  // Broadcast helper function
  const broadcastUpdate = useCallback(async (event: string, payload: any) => {
    if (channelRef.current) {
      await channelRef.current.send({
        type: 'broadcast',
        event,
        payload
      });
    }
  }, []);

  // Update a grade with optimistic updates and broadcast
  const updateGrade = useCallback(async (studentId: string, assignmentId: string, gradeData: Partial<Grade>) => {
    try {
      setSyncStatus('syncing')
      
      // Optimistic update
      const key = `${studentId}-${assignmentId}`
      const existingGrade = data.grades[key]
      const optimisticGrade = {
        ...existingGrade,
        student_id: studentId,
        assignment_id: assignmentId,
        ...gradeData,
        updated_at: new Date().toISOString()
      } as Grade

      setData(prevData => {
        const updatedGrades = { ...prevData.grades, [key]: optimisticGrade }
        const gradesArray = Object.values(updatedGrades)
        const updatedStudents = recalculateStudentStats(prevData.students, gradesArray, prevData.assignments)
        
        return {
          ...prevData,
          grades: updatedGrades,
          students: updatedStudents
        }
      })

      // Perform actual update
      const gradeUpdate = {
        student_id: studentId,
        assignment_id: assignmentId,
        class_instance_id: classInstanceId,
        ...gradeData,
        updated_at: new Date().toISOString()
      }

      const updatedGrade = await gradeService.upsertGrade(gradeUpdate)
      
      // Broadcast the update to other clients
      await broadcastUpdate('grade_update', {
        type: existingGrade ? 'grade_updated' : 'grade_created',
        grade: updatedGrade,
        class_instance_id: classInstanceId
      })
      
      setSyncStatus('synced')
      
    } catch (err) {
      console.error('Error updating grade:', err)
      setError(err instanceof Error ? err.message : 'Failed to update grade')
      setSyncStatus('error')
      
      // Revert optimistic update on error
      await loadGradebookData();
    }
  }, [classInstanceId, data.grades, recalculateStudentStats, loadGradebookData, broadcastUpdate])

  // Create a new assignment with optimistic updates and broadcast
  const createAssignment = useCallback(async (assignmentData: Partial<Assignment>) => {
    try {
      setSyncStatus('syncing')
      
      // Optimistic update
      const tempId = `temp_${Date.now()}`
      const optimisticAssignment = {
        id: tempId,
        class_instance_id: classInstanceId,
        name: (assignmentData as any).title || (assignmentData as any).name || 'New Assignment',
        points_possible: assignmentData.points_possible || 100,
        type: assignmentData.type || 'homework',
        published: assignmentData.published || false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...assignmentData
      } as Assignment

      setData(prevData => ({
        ...prevData,
        assignments: [...prevData.assignments, optimisticAssignment]
      }))

      // Perform actual creation
      const newAssignment = {
        class_instance_id: classInstanceId,
        name: (assignmentData as any).title || (assignmentData as any).name || 'New Assignment',
        points_possible: assignmentData.points_possible || 100,
        type: assignmentData.type || 'homework',
        ...assignmentData
      }

      const createdAssignment = await assignmentService.createAssignment(newAssignment)
      
      // Replace optimistic assignment with real one
      setData(prevData => ({
        ...prevData,
        assignments: prevData.assignments.map(a => 
          a.id === tempId ? createdAssignment : a
        )
      }))

      // Broadcast the update to other clients
      await broadcastUpdate('assignment_update', {
        type: 'assignment_created',
        assignment: createdAssignment,
        class_instance_id: classInstanceId
      })

      setSyncStatus('synced')
    } catch (err) {
      console.error('Error creating assignment:', err)
      setError(err instanceof Error ? err.message : 'Failed to create assignment')
      setSyncStatus('error')
      
      // Revert optimistic update on error
      await loadGradebookData();
    }
  }, [classInstanceId, loadGradebookData, broadcastUpdate])

  // Update an assignment with optimistic updates and broadcast
  const updateAssignment = useCallback(async (assignmentId: string, updates: Partial<Assignment>) => {
    try {
      setSyncStatus('syncing')
      
      // Optimistic update
      setData(prevData => ({
        ...prevData,
        assignments: prevData.assignments.map(a => 
          a.id === assignmentId ? { ...a, ...updates, updated_at: new Date().toISOString() } : a
        )
      }))

      // Perform actual update
      const updatedAssignment = await assignmentService.updateAssignment(assignmentId, updates)
      
      // Broadcast the update to other clients
      await broadcastUpdate('assignment_update', {
        type: 'assignment_updated',
        assignment: updatedAssignment,
        class_instance_id: classInstanceId
      })
      
      setSyncStatus('synced')
      
    } catch (err) {
      console.error('Error updating assignment:', err)
      setError(err instanceof Error ? err.message : 'Failed to update assignment')
      setSyncStatus('error')
      
      // Revert optimistic update on error
      await loadGradebookData();
    }
  }, [loadGradebookData, broadcastUpdate, classInstanceId])

  // Delete an assignment with optimistic updates and broadcast
  const deleteAssignment = useCallback(async (assignmentId: string) => {
    try {
      setSyncStatus('syncing')
      
      // Store assignment for broadcast
      const assignmentToDelete = data.assignments.find(a => a.id === assignmentId)
      
      // Optimistic update
      setData(prevData => ({
        ...prevData,
        assignments: prevData.assignments.filter(a => a.id !== assignmentId)
      }))

      // Perform actual deletion
      await assignmentService.deleteAssignment(assignmentId)
      
      // Broadcast the update to other clients
      if (assignmentToDelete) {
        await broadcastUpdate('assignment_update', {
          type: 'assignment_deleted',
          assignment: assignmentToDelete,
          class_instance_id: classInstanceId
        })
      }
      
      setSyncStatus('synced')
      
    } catch (err) {
      console.error('Error deleting assignment:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete assignment')
      setSyncStatus('error')
      
      // Revert optimistic update on error
      await loadGradebookData();
    }
  }, [data.assignments, loadGradebookData, broadcastUpdate, classInstanceId])

  // Reorder assignments with optimistic updates
  const reorderAssignments = useCallback(async (assignmentId: string, newOrderIndex: number) => {
    try {
      setSyncStatus('syncing')
      
      // Find the assignment being moved
      const movingAssignment = data.assignments.find(a => a.id === assignmentId)
      if (!movingAssignment) {
        throw new Error('Assignment not found')
      }

      // Get current index
      const currentIndex = data.assignments.findIndex(a => a.id === assignmentId)
      
      // Create optimistic update immediately for smooth UX
      const currentAssignments = [...data.assignments]
      const [movedAssignment] = currentAssignments.splice(currentIndex, 1)
      currentAssignments.splice(newOrderIndex, 0, movedAssignment)
      
      // Update order_index for all assignments to match their new positions
      const updatedAssignments = currentAssignments.map((assignment, index) => ({
        ...assignment,
        order_index: index
      }))
      
      // Apply optimistic update
      console.log('🔄 Hook Optimistic Update:', {
        assignmentId,
        newOrderIndex,
        beforeUpdate: data.assignments.map((a, i) => ({ pos: i, name: a.name, order_index: a.order_index })),
        afterUpdate: updatedAssignments.map((a, i) => ({ pos: i, name: a.name, order_index: a.order_index }))
      });
      
      setData(prevData => ({
        ...prevData,
        assignments: updatedAssignments
      }))

      // Call the API to update the assignment order
      const response = await fetch('/api/teach/assignments/reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assignmentId,
          newOrderIndex,
          classInstanceId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to reorder assignments')
      }

      // Broadcast the update to other clients
      await broadcastUpdate('assignment_update', {
        type: 'assignment_updated',
        assignment: movedAssignment,
        class_instance_id: classInstanceId
      })
      
      setSyncStatus('synced')
      
    } catch (err) {
      console.error('Error reordering assignments:', err)
      setError(err instanceof Error ? err.message : 'Failed to reorder assignments')
      setSyncStatus('error')
      
      // Revert optimistic update on error
      await loadGradebookData()
    }
  }, [data.assignments, classInstanceId, loadGradebookData, broadcastUpdate])

  // Update gradebook settings
  const updateSettings = useCallback(async (settings: any) => {
    try {
      setSyncStatus('syncing')
      
      await gradebookSettingsService.upsertGradebookSettings({
        class_instance_id: classInstanceId,
        settings
      })
      
      // Refresh data
      await loadGradebookData();
    } catch (err) {
      console.error('Error updating settings:', err)
      setError(err instanceof Error ? err.message : 'Failed to update settings')
      setSyncStatus('error')
    }
  }, [classInstanceId, loadGradebookData])

  return {
    data,
    isLoading,
    error,
    syncStatus,
    connectionStatus,
    refresh: loadGradebookData,
    updateGrade,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    reorderAssignments,
    updateSettings
  }
} 