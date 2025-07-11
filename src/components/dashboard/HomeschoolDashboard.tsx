'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  UserPlus, 
  GraduationCap, 
  Copy, 
  Plus, 
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
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showAllCodes, setShowAllCodes] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchDashboardData()
  }, [organizationId])

  const fetchDashboardData = async () => {
    setIsLoading(true)
    try {
      // Fetch invite codes
      const { data: codes } = await supabase
        .from('invite_codes')
        .select('*')
        .eq('organisation_id', organizationId)
        .order('created_at', { ascending: false })

      if (codes) {
        setInviteCodes(codes)
      }

      // Fetch students
      const { data: studentProfiles } = await supabase
        .from('profiles')
        .select('user_id, username, first_name, last_name, grade_level, created_at')
        .eq('organisation_id', organizationId)
        .eq('role', 'student')
        .order('created_at', { ascending: false })

      if (studentProfiles) {
        setStudents(studentProfiles.map(profile => ({
          id: profile.user_id,
          username: profile.username,
          first_name: profile.first_name || '',
          last_name: profile.last_name || '',
          grade_level: profile.grade_level,
          created_at: profile.created_at
        })))
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const generateInviteCode = async (role: string) => {
    setIsGenerating(true)
    try {
      const { data, error } = await supabase
        .from('invite_codes')
        .insert([{
          organisation_id: organizationId,
          role: role,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        }])
        .select()
        .single()

      if (error) throw error

      if (data) {
        setInviteCodes(prev => [data, ...prev])
        toast({
          title: "Success",
          description: `New ${role} invite code generated`,
        })
      }
    } catch (error) {
      console.error('Error generating invite code:', error)
      toast({
        title: "Error",
        description: "Failed to generate invite code",
        variant: "destructive"
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = async (text: string, description: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: "Copied!",
        description: `${description} copied to clipboard`,
      })
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Please select and copy the code manually",
        variant: "destructive"
      })
    }
  }

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

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <GraduationCap className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{students.length}</p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Students</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <UserPlus className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{activeStudentCodes.length}</p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Active Codes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">0</p>
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
              <Button
                size="sm"
                onClick={() => generateInviteCode('student')}
                disabled={isGenerating}
              >
                <Plus className="h-4 w-4 mr-2" />
                Generate Code
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
                Generate invite codes to add your children as students
              </p>
              <Button onClick={() => generateInviteCode('student')} disabled={isGenerating}>
                <Plus className="h-4 w-4 mr-2" />
                Generate First Code
              </Button>
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
            <Button variant="outline" className="h-20 flex flex-col items-center justify-center space-y-2">
              <BookOpen className="h-6 w-6" />
              <span className="text-sm">Create Course</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col items-center justify-center space-y-2">
              <GraduationCap className="h-6 w-6" />
              <span className="text-sm">View Gradebook</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col items-center justify-center space-y-2">
              <Settings className="h-6 w-6" />
              <span className="text-sm">Settings</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 