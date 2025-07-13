'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CopyButton } from '@/components/ui/copy-button'
import { 
  UserPlus, 
  Building, 
  Copy, 
  BookOpen, 
  Users,
  Settings,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle,
  Clock,
  AlertCircle,
  Home,
  GraduationCap
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

interface Family {
  id: string
  name: string
  primary_parent_name: string
  student_count: number
  created_at: string
  last_activity?: string
}

interface HomeschoolCoopDashboardProps {
  organizationId: string
  organizationName: string
  userRole: string
}

export default function HomeschoolCoopDashboard({ 
  organizationId, 
  organizationName, 
  userRole 
}: HomeschoolCoopDashboardProps) {
  const [adminCodes, setAdminCodes] = useState<InviteCode[]>([])
  const [families, setFamilies] = useState<Family[]>([])
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
      // Fetch admin invite codes
      const { data: codes } = await supabase
        .from('invite_codes')
        .select('*')
        .eq('organisation_id', organizationId)
        .eq('role', 'admin')
        .order('created_at', { ascending: false })

      if (codes) {
        setAdminCodes(codes)
      }

      // Fetch families (organization units of type 'family')
      const { data: familyUnits } = await supabase
        .from('organisation_units')
        .select(`
          id,
          name,
          created_at,
          homeschool_family_info (
            primary_parent_id
          )
        `)
        .eq('organisation_id', organizationId)
        .eq('unit_type', 'family')
        .order('created_at', { ascending: false })

      if (familyUnits) {
        // Get student counts for each family
        const familiesWithCounts = await Promise.all(
          familyUnits.map(async (unit) => {
            const { count } = await supabase
              .from('profiles')
              .select('*', { count: 'exact', head: true })
              .eq('organisation_unit_id', unit.id)
              .eq('role', 'student')

            // Get primary parent info
            let primaryParentName = 'Unknown'
            if (unit.homeschool_family_info?.[0]?.primary_parent_id) {
              const { data: parentProfile } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('user_id', unit.homeschool_family_info[0].primary_parent_id)
                .single()
              
              if (parentProfile) {
                primaryParentName = `${parentProfile.first_name || ''} ${parentProfile.last_name || ''}`.trim()
              }
            }

            return {
              id: unit.id,
              name: unit.name,
              primary_parent_name: primaryParentName,
              student_count: count || 0,
              created_at: unit.created_at
            }
          })
        )

        setFamilies(familiesWithCounts)
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

  // Remove the generateAdminCode function
  // const generateAdminCode = async () => {
  //   setIsGenerating(true)
  //   try {
  //     const response = await fetch('/api/invite-code/generate', {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify({
  //         role: 'admin',
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

  const activeAdminCodes = adminCodes.filter(code => 
    !code.used_at && (!code.expires_at || new Date(code.expires_at) > new Date())
  )

  const displayedCodes = showAllCodes ? adminCodes : activeAdminCodes

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Co-op Leadership Dashboard</h1>
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
        <Card className="hover-card cursor-pointer hover-bg-light">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Home className="h-5 w-5 text-blue-600 hover-icon" />
              <div>
                <p className="text-2xl font-bold hover-text-highlight">{families.length}</p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Families</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-card cursor-pointer hover-bg-light">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <GraduationCap className="h-5 w-5 text-green-600 hover-icon" />
              <div>
                <p className="text-2xl font-bold hover-text-highlight">
                  {families.reduce((total, family) => total + family.student_count, 0)}
                </p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Total Students</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-card cursor-pointer hover-bg-light">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <UserPlus className="h-5 w-5 text-purple-600 hover-icon" />
              <div>
                <p className="text-2xl font-bold hover-text-highlight">{activeAdminCodes.length}</p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Active Invite Codes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Family Invite Codes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Building className="h-5 w-5" />
                <span>Family Invite Codes</span>
              </CardTitle>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                Share these codes with families to join your co-op
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAllCodes(!showAllCodes)}
              >
                {showAllCodes ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showAllCodes ? 'Hide Used' : 'Show All'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {displayedCodes.length === 0 ? (
            <div className="text-center py-8">
              <UserPlus className="h-12 w-12 mx-auto text-neutral-400 mb-4" />
              <p className="text-neutral-600 dark:text-neutral-400">
                No {showAllCodes ? '' : 'active '}invite codes available. Codes are automatically generated by the system when needed.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedCodes.map((code) => {
                const status = getCodeStatus(code)
                const StatusIcon = status.icon
                
                return (
                  <div key={code.id} className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Building className="h-4 w-4 text-purple-600" />
                      <div>
                        <code className="font-mono text-sm font-semibold">{code.code}</code>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          Family admin code
                        </p>
                      </div>
                      <Badge className={status.color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {status.status}
                      </Badge>
                    </div>
                    <CopyButton
                      text={code.code}
                      description="Family admin code"
                    />
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Families Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Home className="h-5 w-5" />
            <span>Co-op Families</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {families.length === 0 ? (
            <div className="text-center py-8">
              <Home className="h-12 w-12 mx-auto text-neutral-400 mb-4" />
              <p className="text-neutral-600 dark:text-neutral-400">
                No families have joined your co-op yet.
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-500 mt-2">
                Share your admin invite codes with families to get started!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {families.map((family) => (
                <div key={family.id} className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Home className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="font-medium">{family.name}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        Led by {family.primary_parent_name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <Badge variant="outline">
                      <GraduationCap className="h-3 w-3 mr-1" />
                      {family.student_count} students
                    </Badge>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Joined {new Date(family.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Co-op Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/teach/base-classes">
              <Button variant="outline" className="w-full justify-start">
                <BookOpen className="h-4 w-4 mr-2" />
                Manage Shared Courses
              </Button>
            </Link>
            <Link href="/teach/instances">
              <Button variant="outline" className="w-full justify-start">
                <Users className="h-4 w-4 mr-2" />
                View All Classes
              </Button>
            </Link>
            <Link href="/school">
              <Button variant="outline" className="w-full justify-start">
                <Settings className="h-4 w-4 mr-2" />
                Co-op Settings
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Getting Started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm space-y-2">
              <p><strong>Step 1:</strong> Invite codes are automatically generated by the system</p>
              <p><strong>Step 2:</strong> Share codes with families</p>
              <p><strong>Step 3:</strong> Create shared courses</p>
              <p><strong>Step 4:</strong> Start teaching together!</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 