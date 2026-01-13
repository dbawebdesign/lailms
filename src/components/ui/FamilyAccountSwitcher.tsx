'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ChevronDown, User, GraduationCap, LogOut, Settings } from 'lucide-react'
import { toast } from 'sonner'
import { triggerChatLogout } from '@/utils/chatPersistence'

interface FamilyMember {
  id: string
  firstName: string
  lastName?: string
  role: 'teacher' | 'student'
  gradeLevel?: string
  email?: string
  isCurrent: boolean
  isSubAccount?: boolean
}

export default function FamilyAccountSwitcher() {
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [currentUser, setCurrentUser] = useState<FamilyMember | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSwitching, setIsSwitching] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    loadFamilyMembers()
  }, [])

  // Listen for cookie changes to update the current user display
  useEffect(() => {
    const handleCookieChange = () => {
      loadFamilyMembers()
    }

    // Listen for storage events (though cookies don't trigger these, we'll use a custom event)
    window.addEventListener('familyMemberChanged', handleCookieChange)
    
    return () => {
      window.removeEventListener('familyMemberChanged', handleCookieChange)
    }
  }, [])

  const loadFamilyMembers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get current user profile with organization info
      const { data: profile } = await supabase
        .from('profiles')
        .select(`
          *,
          organisations (
            id,
            organisation_type
          )
        `)
        .eq('user_id', user.id)
        .single()

      if (!profile) return

      console.log('Current profile:', profile)

      const members: FamilyMember[] = []

      // Check if this is a homeschool organization
      const isHomeschool = profile.organisations?.organisation_type === 'individual_family' || 
                          profile.organisations?.organisation_type === 'homeschool_coop'

      if (!isHomeschool) {
        // Not a homeschool account, don't show switcher
        setFamilyMembers([])
        setIsLoading(false)
        return
      }

      // Check for active family member cookie to determine who is currently active
      const activeFamilyMemberCookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('active_family_member='))
      const activeFamilyMemberId = activeFamilyMemberCookie?.split('=')[1]
      
      console.log('Active family member from cookie:', activeFamilyMemberId)

      // Get all family members - both through family_id and organisation_id
      let allProfiles = []
      
      // First try to get members by family_id
      if (profile.family_id) {
        const { data: familyMembers } = await supabase
          .from('profiles')
          .select('*')
          .eq('family_id', profile.family_id)
          .order('role', { ascending: true })
        
        if (familyMembers) {
          allProfiles = familyMembers
        }
      }
      
      // Also try organisation_id to get additional members (not just fallback)
      if (profile.organisation_id) {
        const { data: orgMembers } = await supabase
          .from('profiles')
          .select('*')
          .eq('organisation_id', profile.organisation_id)
          .order('role', { ascending: true })
        
        if (orgMembers) {
          // Merge org members with family members, avoiding duplicates
          orgMembers.forEach(orgMember => {
            if (!allProfiles.find(p => p.user_id === orgMember.user_id)) {
              allProfiles.push(orgMember)
            }
          })
        }
      }

      console.log('Found family members:', allProfiles)

      // Format all members
      allProfiles.forEach(member => {
        // Determine if this member is currently active
        // If there's an active family member cookie, use that; otherwise, default to authenticated user
        const isCurrent = activeFamilyMemberId 
          ? member.user_id === activeFamilyMemberId 
          : member.user_id === user.id
          
        // Determine if this member should be treated as a teacher
        const isTeacherRole = ['teacher', 'admin', 'super_admin'].includes(member.role)
        
        const formattedMember: FamilyMember = {
          id: member.user_id,
          firstName: member.first_name || (isTeacherRole ? 'Teacher' : 'Student'),
          lastName: member.last_name || '',
          role: isTeacherRole ? 'teacher' : 'student',
          gradeLevel: member.grade_level,
          email: member.user_id === user.id ? user.email : undefined, // Only show email for authenticated user
          isCurrent,
          isSubAccount: member.is_sub_account || false
        }
        
        members.push(formattedMember)
        
        if (isCurrent) {
          setCurrentUser(formattedMember)
        }
      })

      // Also check family_students table for additional students
      if (profile.family_id) {
        const { data: familyStudents } = await supabase
          .from('family_students')
          .select(`
            student_id,
            profiles!family_students_student_id_fkey (
              user_id,
              first_name,
              last_name,
              grade_level,
              role
            )
          `)
          .eq('family_id', profile.family_id)

        console.log('Found family_students entries:', familyStudents)

        if (familyStudents) {
          familyStudents.forEach(fs => {
            if (fs.profiles && !members.find(m => m.id === fs.student_id)) {
              const isCurrent = activeFamilyMemberId 
                ? fs.student_id === activeFamilyMemberId 
                : false // Family students are never the authenticated user
                
              const formattedMember: FamilyMember = {
                id: fs.student_id,
                firstName: (fs.profiles as any).first_name || 'Student',
                lastName: (fs.profiles as any).last_name || '',
                role: 'student',
                gradeLevel: (fs.profiles as any).grade_level,
                isCurrent,
                isSubAccount: true // Students from family_students are always sub-accounts
              }
              
              members.push(formattedMember)
              
              if (isCurrent) {
                setCurrentUser(formattedMember)
              }
            }
          })
        }
      }

      console.log('Final family members:', members)
      setFamilyMembers(members)
    } catch (error) {
      console.error('Error loading family members:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAccountSwitch = async (memberId: string) => {
    if (memberId === currentUser?.id) return
    
    setIsSwitching(true)
    
    try {
      const targetMember = familyMembers.find(m => m.id === memberId)
      if (!targetMember) throw new Error('Member not found')

      // Get the target user's credentials from our API
      const response = await fetch('/api/auth/family-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: memberId })
      })

      if (!response.ok) {
        throw new Error('Failed to switch account')
      }

      const { success, redirectUrl } = await response.json()

      if (success) {
        toast.success(`Switching to ${targetMember.firstName}'s account...`)
        
        // Update the current user in state
        setFamilyMembers(members => 
          members.map(m => ({ ...m, isCurrent: m.id === memberId }))
        )
        setCurrentUser(targetMember)
        
        // Dispatch custom event to notify other components
        window.dispatchEvent(new CustomEvent('familyMemberChanged', { 
          detail: { memberId, member: targetMember } 
        }))
        
        // Redirect based on role
        if (targetMember.role === 'student') {
          router.push('/learn')
        } else {
          router.push('/teach')
        }
        
        // Force a page refresh to update all components
        router.refresh()
      }
    } catch (error) {
      console.error('Error switching account:', error)
      toast.error('Failed to switch account')
    } finally {
      setIsSwitching(false)
    }
  }

  const handleSignOut = async () => {
    // Trigger chat history cleanup before logout
    triggerChatLogout();
    
    // Clear family member cookie before logout
    try {
      await fetch('/api/auth/clear-family-cookie', { method: 'POST' });
    } catch (error) {
      console.warn('Failed to clear family cookie:', error);
    }
    
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (isLoading) {
    return (
      <div className="h-10 w-10 rounded-full bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
    )
  }

  // Show basic user menu if no family members found (non-homeschool account)
  if (!currentUser || familyMembers.length === 0) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="flex items-center space-x-2 h-8"
          >
            <User className="h-4 w-4" />
            <span className="text-sm font-medium">Account</span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">My Account</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Sign Out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="h-10 px-3 gap-2 hover:text-[#1A1A1A] dark:hover:text-white [&_*]:hover:text-[#1A1A1A] dark:[&_*]:hover:text-white"
          disabled={isSwitching}
        >
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-xs bg-gradient-to-br from-blue-500 to-purple-500 text-white">
              {currentUser.firstName.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium hidden md:inline">
            {currentUser.firstName}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">Switch Account</p>
            <p className="text-xs text-muted-foreground">
              Select a family member
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Show all family members */}
        {familyMembers.map((member, index) => {
          const isTeacher = member.role === 'teacher'
          const Icon = isTeacher ? User : GraduationCap
          
          return (
            <div key={member.id}>
              {/* Add section headers */}
              {index === 0 && isTeacher && (
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  Parent/Teacher
                </div>
              )}
              {index > 0 && !isTeacher && familyMembers[index - 1].role === 'teacher' && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    Students
                  </div>
                </>
              )}
              
              <DropdownMenuItem
                onClick={() => handleAccountSwitch(member.id)}
                disabled={member.isCurrent || isSwitching}
                className="cursor-pointer flex items-center"
              >
                <Icon className="mr-2 h-4 w-4" />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {member.firstName} {member.lastName && member.lastName}
                  </p>
                  {member.role === 'student' && member.gradeLevel && (
                    <p className="text-xs text-muted-foreground">
                      Grade {member.gradeLevel}
                    </p>
                  )}
                  {member.role === 'teacher' && member.email && (
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  )}
                </div>
                {member.isCurrent && (
                  <div className="ml-2 h-2 w-2 rounded-full bg-green-500" />
                )}
              </DropdownMenuItem>
            </div>
          )
        })}
        
        {/* Show message if only one member */}
        {familyMembers.length === 1 && (
          <div className="px-2 py-2 text-xs text-muted-foreground text-center">
            No other family members to switch to
          </div>
        )}
        
        <DropdownMenuSeparator />
        {/* Only show settings for non-sub-accounts (parent/teacher accounts) */}
        {currentUser && !currentUser.isSubAccount && (
          <DropdownMenuItem onClick={() => router.push('/settings')}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
