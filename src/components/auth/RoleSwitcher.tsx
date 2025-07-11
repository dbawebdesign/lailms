'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'
import { Loader2, UserCheck, Crown, Shield, GraduationCap, Users, BookOpen } from 'lucide-react'

interface RoleInfo {
  currentRole: string
  availableRoles: string[]
  hasMultipleRoles: boolean
  user: {
    id: string
    name: string
    organizationId: string
  }
}

const roleIcons = {
  super_admin: Crown,
  admin: Shield,
  teacher: GraduationCap,
  student: BookOpen,
  parent: Users
}

const roleLabels = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  teacher: 'Teacher',
  student: 'Student',
  parent: 'Parent'
}

const roleDescriptions = {
  super_admin: 'Full access to all organization features and settings',
  admin: 'Manage users, classes, and organizational settings',
  teacher: 'Create and manage courses, lessons, and assess students',
  student: 'Access courses, take assessments, and track progress',
  parent: 'Monitor student progress and communicate with teachers'
}

const roleColors = {
  super_admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  teacher: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  student: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  parent: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
}

interface RoleSwitcherProps {
  onRoleChange?: (newRole: string) => void
  compact?: boolean
}

export default function RoleSwitcher({ onRoleChange, compact = false }: RoleSwitcherProps) {
  const [roleInfo, setRoleInfo] = useState<RoleInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSwitching, setIsSwitching] = useState(false)

  useEffect(() => {
    fetchRoleInfo()
  }, [])

  const fetchRoleInfo = async () => {
    try {
      const response = await fetch('/api/auth/switch-role')
      
      if (!response.ok) {
        throw new Error('Failed to fetch role information')
      }

      const data = await response.json()
      setRoleInfo(data)
    } catch (error) {
      console.error('Error fetching role info:', error)
      toast({
        title: "Error",
        description: "Failed to load role information",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRoleChange = async (newRole: string) => {
    if (!roleInfo || newRole === roleInfo.currentRole) return

    setIsSwitching(true)
    
    try {
      const response = await fetch('/api/auth/switch-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newRole })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to switch role')
      }

      const data = await response.json()
      
      // Update role info
      setRoleInfo(prev => prev ? { ...prev, currentRole: newRole } : null)
      
      // Call callback if provided
      if (onRoleChange) {
        onRoleChange(newRole)
      }

      toast({
        title: "Role switched",
        description: `You are now acting as ${roleLabels[newRole as keyof typeof roleLabels]}`,
      })

      // Refresh the page to ensure UI updates properly
      window.location.reload()

    } catch (error) {
      console.error('Error switching role:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to switch role',
        variant: "destructive"
      })
    } finally {
      setIsSwitching(false)
    }
  }

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center ${compact ? 'p-2' : 'p-4'}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    )
  }

  if (!roleInfo || !roleInfo.hasMultipleRoles) {
    return null
  }

  if (compact) {
    return (
      <div className="flex items-center space-x-2">
        <Select
          value={roleInfo.currentRole}
          onValueChange={handleRoleChange}
          disabled={isSwitching}
        >
          <SelectTrigger className="w-32">
            <SelectValue>
              <div className="flex items-center space-x-2">
                {roleIcons[roleInfo.currentRole as keyof typeof roleIcons] && (
                  <div className="h-4 w-4">
                    {roleIcons[roleInfo.currentRole as keyof typeof roleIcons]({ className: 'h-4 w-4' })}
                  </div>
                )}
                <span className="text-sm">
                  {roleLabels[roleInfo.currentRole as keyof typeof roleLabels]}
                </span>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {roleInfo.availableRoles.map((role) => {
              const Icon = roleIcons[role as keyof typeof roleIcons]
              return (
                <SelectItem key={role} value={role}>
                  <div className="flex items-center space-x-2">
                    {Icon && <Icon className="h-4 w-4" />}
                    <span>{roleLabels[role as keyof typeof roleLabels]}</span>
                  </div>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
        {isSwitching && (
          <Loader2 className="h-4 w-4 animate-spin" />
        )}
      </div>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <UserCheck className="h-5 w-5" />
          <span>Role Switcher</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Current Role:</span>
            <Badge className={roleColors[roleInfo.currentRole as keyof typeof roleColors]}>
              {roleLabels[roleInfo.currentRole as keyof typeof roleLabels]}
            </Badge>
          </div>
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            {roleDescriptions[roleInfo.currentRole as keyof typeof roleDescriptions]}
          </p>
        </div>

        <div className="space-y-2">
          <span className="text-sm font-medium">Available Roles:</span>
          <div className="space-y-2">
            {roleInfo.availableRoles
              .filter(role => role !== roleInfo.currentRole)
              .map((role) => {
                const Icon = roleIcons[role as keyof typeof roleIcons]
                return (
                  <Button
                    key={role}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => handleRoleChange(role)}
                    disabled={isSwitching}
                  >
                    <div className="flex items-center space-x-2">
                      {Icon && <Icon className="h-4 w-4" />}
                      <span>{roleLabels[role as keyof typeof roleLabels]}</span>
                    </div>
                  </Button>
                )
              })}
          </div>
        </div>

        <div className="text-xs text-neutral-500 dark:text-neutral-400">
          <p>Switching roles will refresh the page to update your permissions.</p>
        </div>
      </CardContent>
    </Card>
  )
} 