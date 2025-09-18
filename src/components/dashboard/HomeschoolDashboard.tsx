'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  UserPlus,
  GraduationCap, 
  BookOpen, 
  Users,
  Settings,
  RefreshCw
} from 'lucide-react'
import { toast } from '@/components/ui/use-toast'
import { createClient } from '@/lib/supabase/client'
import { useCourseCreationModal } from '@/hooks/useCourseCreationModal'


interface Student {
  id: string
  username: string
  first_name: string
  last_name: string
  grade_level?: string
  created_at: string
  last_activity?: string
}

interface HomeschoolDashboardProps {
  organizationId: string
  organizationName: string
  userRole: string
}

export default function HomeschoolDashboard({ 
  organizationId, 
  organizationName, 
  userRole 
}: HomeschoolDashboardProps) {
  const [students, setStudents] = useState<Student[]>([])
  const [activeCourses, setActiveCourses] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()
  
  const { openModal, CourseCreationModal } = useCourseCreationModal({ 
    organisationId: organizationId 
  })

  useEffect(() => {
    fetchDashboardData()
  }, [organizationId])

  const fetchDashboardData = async () => {
    setIsLoading(true)
    try {
      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        console.error('Auth error:', authError)
        return
      }



      // Fetch students (profiles with student role in this organization)
      const { data: studentProfiles, error: studentsError } = await supabase
        .from('profiles')
        .select('*')
        .eq('organisation_id', organizationId)
        .eq('role', 'student')
        .order('created_at', { ascending: false })

      if (studentsError) {
        console.error('Error fetching students:', studentsError)
      } else {
        const mappedStudents = studentProfiles?.map(profile => ({
          id: profile.user_id,
          username: profile.username || `${profile.first_name} ${profile.last_name}`,
          first_name: profile.first_name || '',
          last_name: profile.last_name || '',
          grade_level: profile.grade_level,
          created_at: profile.created_at,
          last_activity: profile.last_activity
        })) || []
        setStudents(mappedStudents)
      }

      // Fetch active courses (class instances where the current user is the teacher)
      const { data: activeClassInstances, error: coursesError } = await supabase
        .from('class_instances')
        .select(`
          id,
          name,
          status,
          base_classes!inner (
            user_id,
            organisation_id
          )
        `)
        .eq('base_classes.user_id', user.id)
        .eq('status', 'active')
        .eq('base_classes.organisation_id', organizationId)

      if (coursesError) {
        console.error('Error fetching active courses:', coursesError)
        setActiveCourses(0)
      } else {
        console.log('Active class instances found:', activeClassInstances?.length || 0)
        console.log('Active class instances data:', activeClassInstances)
        setActiveCourses(activeClassInstances?.length || 0)
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Remove the generateInviteCode function
  // const generateInviteCode = async (role: string) => {
  //   setIsGenerating(true)
  //   try {
  //     const response = await fetch('/api/invite-code/generate', {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify({
  //         role,
  //         organizationId,
  //       }),
  //     })

  //     if (!response.ok) {
  //       throw new Error('Failed to generate invite code')
  //     }

  //     const data = await response.json()
  //     setInviteCodes(prev => [data.inviteCode, ...prev])
  //   } catch (error) {
  //     console.error('Error generating invite code:', error)
  //   } finally {
  //     setIsGenerating(false)
  //   }
  // }



  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Homeschool Dashboard</h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            {organizationName}
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={fetchDashboardData}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {activeCourses === 0 ? (
        /* First Time User Layout - No Base Classes Created */
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Button variant="outline" className="min-h-[120px] flex flex-col items-center justify-center space-y-3 p-6 hover-button-glow bg-card/70 dark:bg-card/60 border-border/60 dark:border-border/40 hover:bg-card/90 dark:hover:bg-card/80 transition-colors shadow-sm dark:shadow-md hover:text-[#1A1A1A] dark:hover:text-white [&_.text-sm]:hover:text-[#1A1A1A] dark:[&_.text-sm]:hover:text-white [&_.text-xs]:hover:text-[#1A1A1A] dark:[&_.text-xs]:hover:text-white" onClick={openModal}>
                  <BookOpen className="h-8 w-8 hover-icon text-blue-600" />
                  <div className="text-center space-y-1">
                    <span className="text-sm font-medium block">Create Course</span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 block">Start with AI</span>
                  </div>
                </Button>
                <Button asChild variant="outline" className="min-h-[120px] flex flex-col items-center justify-center space-y-3 p-6 hover-button-glow bg-card/70 dark:bg-card/60 border-border/60 dark:border-border/40 hover:bg-card/90 dark:hover:bg-card/80 transition-colors shadow-sm dark:shadow-md hover:text-[#1A1A1A] dark:hover:text-white [&_.text-sm]:hover:text-[#1A1A1A] dark:[&_.text-sm]:hover:text-white [&_.text-xs]:hover:text-[#1A1A1A] dark:[&_.text-xs]:hover:text-white">
                  <Link href="/homeschool/add-students">
                    <Users className="h-8 w-8 hover-icon text-green-600" />
                    <div className="text-center space-y-1">
                      <span className="text-sm font-medium block">Add Students</span>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400 block">Manage family</span>
                    </div>
                  </Link>
                </Button>
                <Button asChild variant="outline" className="min-h-[120px] flex flex-col items-center justify-center space-y-3 p-6 hover-button-glow bg-card/70 dark:bg-card/60 border-border/60 dark:border-border/40 hover:bg-card/90 dark:hover:bg-card/80 transition-colors shadow-sm dark:shadow-md hover:text-[#1A1A1A] dark:hover:text-white [&_.text-sm]:hover:text-[#1A1A1A] dark:[&_.text-sm]:hover:text-white [&_.text-xs]:hover:text-[#1A1A1A] dark:[&_.text-xs]:hover:text-white">
                  <Link href="/teach/gradebook">
                    <GraduationCap className="h-8 w-8 hover-icon text-purple-600" />
                    <div className="text-center space-y-1">
                      <span className="text-sm font-medium block">Gradebook</span>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400 block">Track progress</span>
                    </div>
                  </Link>
                </Button>
                <Button asChild variant="outline" className="min-h-[120px] flex flex-col items-center justify-center space-y-3 p-6 hover-button-glow bg-card/70 dark:bg-card/60 border-border/60 dark:border-border/40 hover:bg-card/90 dark:hover:bg-card/80 transition-colors shadow-sm dark:shadow-md hover:text-[#1A1A1A] dark:hover:text-white [&_.text-sm]:hover:text-[#1A1A1A] dark:[&_.text-sm]:hover:text-white [&_.text-xs]:hover:text-[#1A1A1A] dark:[&_.text-xs]:hover:text-white">
                  <Link href="/teach/tools">
                    <Settings className="h-8 w-8 hover-icon text-orange-600" />
                    <div className="text-center space-y-1">
                      <span className="text-sm font-medium block">Teacher Tools</span>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400 block">Manage settings</span>
                    </div>
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Students Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <GraduationCap className="h-5 w-5" />
                <span>Your Students</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {students.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                    No students yet
                  </h3>
                  <p className="text-neutral-500 dark:text-neutral-400 mb-4">
                    Add your first student to get started
                  </p>
                  <Button asChild variant="outline">
                    <Link href="/homeschool/add-students">
                      <UserPlus className="mr-2 h-4 w-4" />
                      Add Your First Student
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {students.map((student) => (
                    <div key={student.id} className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                            {student.first_name?.charAt(0) || student.username?.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">
                            {student.first_name} {student.last_name}
                          </p>
                          <p className="text-sm text-neutral-500 dark:text-neutral-400">
                            @{student.username}
                            {student.grade_level && ` • Grade ${student.grade_level}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">
                          Joined {new Date(student.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Big Call to Action */}
          <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-2 border-dashed border-blue-200 dark:border-blue-800">
            <CardContent className="pt-12 pb-12">
              <div className="text-center">
                <BookOpen className="h-16 w-16 text-blue-600 mx-auto mb-6" />
                <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-4">
                  Ready to create your first class?
                </h2>
                <p className="text-neutral-600 dark:text-neutral-400 max-w-md mx-auto mb-8">
                  Let's get started with AI-powered course creation. It only takes a few minutes to build a complete curriculum.
                </p>
                <Button asChild size="lg" className="px-8 py-6 text-lg">
                  <Link href="/teach/knowledge-base/create">
                    <BookOpen className="mr-3 h-5 w-5" />
                    Create Your First Class
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Existing User Layout - Has Base Classes */
        <div className="space-y-6">
          {/* Quick Actions - Positioned at top for easy access */}
          <Card style={{"--animation-delay": "100ms"} as React.CSSProperties}>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Button variant="outline" className="min-h-[100px] flex flex-col items-center justify-center space-y-3 p-6 dark-mode-safe-hover bg-card/70 dark:bg-card/60 border-border/60 dark:border-border/40 hover:bg-card/90 dark:hover:bg-card/80 transition-colors shadow-sm dark:shadow-md hover:text-[#1A1A1A] dark:hover:text-white [&_span]:hover:text-[#1A1A1A] dark:[&_span]:hover:text-white animate-gentle-fade-in" style={{"--animation-delay": "300ms"} as React.CSSProperties} onClick={openModal}>
                  <BookOpen className="h-8 w-8 hover-icon text-blue-600" />
                  <span className="text-sm font-medium">Create Course</span>
                </Button>
                <Button asChild variant="outline" className="min-h-[100px] flex flex-col items-center justify-center space-y-3 p-6 dark-mode-safe-hover bg-card/70 dark:bg-card/60 border-border/60 dark:border-border/40 hover:bg-card/90 dark:hover:bg-card/80 transition-colors shadow-sm dark:shadow-md hover:text-[#1A1A1A] dark:hover:text-white [&_span]:hover:text-[#1A1A1A] dark:[&_span]:hover:text-white animate-gentle-fade-in" style={{"--animation-delay": "400ms"} as React.CSSProperties}>
                  <Link href="/homeschool/add-students">
                    <Users className="h-8 w-8 hover-icon text-green-600" />
                    <span className="text-sm font-medium">Add Students</span>
                  </Link>
                </Button>
                <Button asChild variant="outline" className="min-h-[100px] flex flex-col items-center justify-center space-y-3 p-6 dark-mode-safe-hover bg-card/70 dark:bg-card/60 border-border/60 dark:border-border/40 hover:bg-card/90 dark:hover:bg-card/80 transition-colors shadow-sm dark:shadow-md hover:text-[#1A1A1A] dark:hover:text-white [&_span]:hover:text-[#1A1A1A] dark:[&_span]:hover:text-white animate-gentle-fade-in" style={{"--animation-delay": "500ms"} as React.CSSProperties}>
                  <Link href="/teach/gradebook">
                    <GraduationCap className="h-8 w-8 hover-icon text-purple-600" />
                    <span className="text-sm font-medium">View Gradebook</span>
                  </Link>
                </Button>
                <Button asChild variant="outline" className="min-h-[100px] flex flex-col items-center justify-center space-y-3 p-6 dark-mode-safe-hover bg-card/70 dark:bg-card/60 border-border/60 dark:border-border/40 hover:bg-card/90 dark:hover:bg-card/80 transition-colors shadow-sm dark:shadow-md hover:text-[#1A1A1A] dark:hover:text-white [&_span]:hover:text-[#1A1A1A] dark:[&_span]:hover:text-white animate-gentle-fade-in" style={{"--animation-delay": "600ms"} as React.CSSProperties}>
                  <Link href="/teach/tools">
                    <Settings className="h-8 w-8 hover-icon text-orange-600" />
                    <span className="text-sm font-medium">Teacher Tools</span>
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="hover-card cursor-pointer hover-bg-light" style={{"--animation-delay": "700ms"} as React.CSSProperties}>
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2">
                  <GraduationCap className="h-5 w-5 text-blue-600 hover-icon" />
                  <div>
                    <p className="text-2xl font-bold hover-text-highlight">{students.length}</p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">Students</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="hover-card cursor-pointer hover-bg-light" style={{"--animation-delay": "800ms"} as React.CSSProperties}>
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2">
                  <BookOpen className="h-5 w-5 text-purple-600 hover-icon" />
                  <div>
                    <p className="text-2xl font-bold hover-text-highlight">{activeCourses}</p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">Active Courses</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Students Section */}
          <Card style={{"--animation-delay": "900ms"} as React.CSSProperties}>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <GraduationCap className="h-5 w-5" />
                <span>Your Students</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {students.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                    No students yet
                  </h3>
                  <p className="text-neutral-500 dark:text-neutral-400 mb-4">
                    Add students to get started with your homeschool
                  </p>
                  <Button asChild variant="outline">
                    <Link href="/homeschool/add-students">
                      <UserPlus className="mr-2 h-4 w-4" />
                      Add Your First Student
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {students.map((student) => (
                    <div key={student.id} className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                            {student.first_name?.charAt(0) || student.username?.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">
                            {student.first_name} {student.last_name}
                          </p>
                          <p className="text-sm text-neutral-500 dark:text-neutral-400">
                            @{student.username}
                            {student.grade_level && ` • Grade ${student.grade_level}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">
                          Joined {new Date(student.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      
      <CourseCreationModal />
    </div>
  )
} 