'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  UserPlus, 
  GraduationCap, 
  Copy, 
  BookOpen, 
  Users,
  Settings,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react'
import { toast } from '@/components/ui/use-toast'
import { createClient } from '@/lib/supabase/client'
import { useInviteCodeClipboard } from '@/hooks/useClipboard'

interface InviteCode {
  id: string
  code: string
  role: string
  created_at: string
  expires_at?: string
  used_at?: string
  status?: string
}

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
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [activeCourses, setActiveCourses] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)
  const [showAllCodes, setShowAllCodes] = useState(false)
  const supabase = createClient()
  const { copy: copyToClipboard } = useInviteCodeClipboard()

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

      // Fetch invite codes
      const { data: codes, error: codesError } = await supabase
        .from('invite_codes')
        .select('*')
        .eq('organisation_id', organizationId)
        .order('created_at', { ascending: false })

      if (codesError) {
        console.error('Error fetching invite codes:', codesError)
      } else {
        setInviteCodes(codes || [])
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

  const getCodeStatus = (code: InviteCode) => {
    if (code.used_at) {
      return { status: 'used', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100', icon: CheckCircle }
    }
    if (code.expires_at && new Date(code.expires_at) < new Date()) {
      return { status: 'expired', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100', icon: AlertCircle }
    }
    return { status: 'active', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100', icon: Clock }
  }

  const activeStudentCodes = inviteCodes.filter(code => 
    code.role === 'student' && !code.used_at && 
    (!code.expires_at || new Date(code.expires_at) > new Date())
  )

  const displayedCodes = showAllCodes ? inviteCodes : activeStudentCodes

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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Button asChild variant="outline" className="h-20 flex flex-col items-center justify-center space-y-2 hover-button-glow">
                  <Link href="/teach/knowledge-base/create">
                    <BookOpen className="h-6 w-6 hover-icon text-blue-600" />
                    <span className="text-sm font-medium">Create Course</span>
                    <span className="text-xs text-neutral-500">Start with AI</span>
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-20 flex flex-col items-center justify-center space-y-2 hover-button-glow">
                  <Link href="/homeschool/add-students">
                    <Users className="h-6 w-6 hover-icon text-green-600" />
                    <span className="text-sm font-medium">Add Students</span>
                    <span className="text-xs text-neutral-500">Manage family</span>
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-20 flex flex-col items-center justify-center space-y-2 hover-button-glow">
                  <Link href="/teach/gradebook">
                    <GraduationCap className="h-6 w-6 hover-icon text-purple-600" />
                    <span className="text-sm font-medium">Gradebook</span>
                    <span className="text-xs text-neutral-500">Track progress</span>
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-20 flex flex-col items-center justify-center space-y-2 hover-button-glow">
                  <Link href="/teach/tools">
                    <Settings className="h-6 w-6 hover-icon text-orange-600" />
                    <span className="text-sm font-medium">Teacher Tools</span>
                    <span className="text-xs text-neutral-500">Manage settings</span>
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
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="hover-card cursor-pointer hover-bg-light">
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
            
            <Card className="hover-card cursor-pointer hover-bg-light">
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2">
                  <UserPlus className="h-5 w-5 text-green-600 hover-icon" />
                  <div>
                    <p className="text-2xl font-bold hover-text-highlight">{activeStudentCodes.length}</p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">Active Codes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="hover-card cursor-pointer hover-bg-light">
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

          {/* Invite Codes Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <UserPlus className="h-5 w-5" />
                  <span>Student Invite Codes</span>
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAllCodes(!showAllCodes)}
                  >
                    {showAllCodes ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                    {showAllCodes ? 'Hide Used' : 'Show All'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {displayedCodes.length === 0 ? (
                <div className="text-center py-8">
                  <UserPlus className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                    No {showAllCodes ? '' : 'active '}invite codes
                  </h3>
                  <p className="text-neutral-500 dark:text-neutral-400 mb-4">
                    Invite codes are automatically generated by the system when needed
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {displayedCodes.map((code) => {
                    const statusInfo = getCodeStatus(code)
                    const StatusIcon = statusInfo.icon
                    
                    return (
                      <div key={code.id} className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <GraduationCap className="h-4 w-4 text-blue-600" />
                          <div>
                            <div className="flex items-center space-x-2">
                              <code className="font-mono text-sm font-semibold">{code.code}</code>
                              <Badge variant="outline" className={statusInfo.color}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {statusInfo.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                              Created {new Date(code.created_at).toLocaleDateString()}
                              {code.expires_at && ` • Expires ${new Date(code.expires_at).toLocaleDateString()}`}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(code.code, 'Invite code')}
                          disabled={code.used_at !== null}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
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
                    Students will appear here once they join using invite codes
                  </p>
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

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button asChild variant="outline" className="h-20 flex flex-col items-center justify-center space-y-2 hover-button-glow">
                  <Link href="/teach/knowledge-base/create">
                    <BookOpen className="h-6 w-6 hover-icon" />
                    <span className="text-sm">Create Course</span>
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-20 flex flex-col items-center justify-center space-y-2 hover-button-glow">
                  <Link href="/teach/gradebook">
                    <GraduationCap className="h-6 w-6 hover-icon" />
                    <span className="text-sm">View Gradebook</span>
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-20 flex flex-col items-center justify-center space-y-2 hover-button-glow">
                  <Link href="/teach/tools">
                    <Settings className="h-6 w-6 hover-icon" />
                    <span className="text-sm">Teacher Tools</span>
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
} 