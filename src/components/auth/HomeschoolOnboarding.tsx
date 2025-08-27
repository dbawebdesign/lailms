'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { 
  Loader2, 
  Home, 
  Users, 
  ArrowRight, 
  ArrowLeft,
  UserPlus,
  GraduationCap,
  CreditCard,
  CheckCircle,
  X,
  Plus,
  Building
} from 'lucide-react'
import { buildPaymentLink, createCheckoutSession } from '@/lib/stripe/config'
import Image from 'next/image'

type OrganizationType = 'individual_family' | 'coop_network' | ''
type OnboardingStep = 'organization_type' | 'teacher_info' | 'add_students' | 'payment' | 'complete'

interface Student {
  id: string
  firstName: string
  gradeLevel: string
}

interface CoopOnboardingProps {
  onBack: () => void
}

function CoopOnboarding({ onBack }: CoopOnboardingProps) {
  const [coopChoice, setCoopChoice] = useState<'create' | 'join' | ''>('')
  const [coopName, setCoopName] = useState('')
  const [numberOfFamilies, setNumberOfFamilies] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleCreateCoop = async () => {
    if (!firstName || !lastName || !coopName || !numberOfFamilies) {
      toast.error('Please fill in all required fields')
      return
    }

    setIsLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No authenticated user')

      // Create the co-op organization
      const { data: org, error: orgError } = await supabase
        .from('organisations')
        .insert({
          name: coopName,
          organisation_type: 'coop_network',
          settings: {
            estimated_families: parseInt(numberOfFamilies)
          }
        })
        .select()
        .single()

      if (orgError) throw orgError

      // Update user profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: firstName,
          last_name: lastName,
          organisation_id: org.id,
          role: 'admin',
          is_primary_parent: true,
          onboarding_completed: false,
          onboarding_step: 'payment'
        })
        .eq('user_id', user.id)

      if (profileError) throw profileError

      // Generate admin invite codes for the co-op
      const { error: inviteError } = await supabase
        .from('invite_codes')
        .insert({
          code: `${coopName.toLowerCase().replace(/\s+/g, '-')}-admin-${Math.random().toString(36).substr(2, 9)}`,
          organisation_id: org.id,
          role: 'admin',
          created_by: user.id
        })

      if (inviteError) throw inviteError

      toast.success('Co-op created successfully!')
      
      // Redirect to payment
      const { url } = await createCheckoutSession()
      window.location.href = url
    } catch (error: any) {
      console.error('Error creating co-op:', error)
      toast.error(error.message || 'Failed to create co-op')
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoinCoop = async () => {
    if (!firstName || !lastName || !joinCode) {
      toast.error('Please fill in all required fields')
      return
    }

    setIsLoading(true)
    try {
      // Verify the invite code
      const response = await fetch('/api/invite-code/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: joinCode })
      })

      if (!response.ok) {
        throw new Error('Invalid invite code')
      }

      const codeData = await response.json()
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No authenticated user')

      // Update user profile with co-op info
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: firstName,
          last_name: lastName,
          organisation_id: codeData.organisation.id,
          role: 'teacher',
          is_primary_parent: true,
          onboarding_completed: false,
          onboarding_step: 'add_students'
        })
        .eq('user_id', user.id)

      if (profileError) throw profileError

      toast.success('Successfully joined the co-op!')
      router.push('/dashboard')
    } catch (error: any) {
      console.error('Error joining co-op:', error)
      toast.error(error.message || 'Failed to join co-op')
    } finally {
      setIsLoading(false)
    }
  }

  if (!coopChoice) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Homeschool Co-op/Network Setup</CardTitle>
          <CardDescription>Would you like to create a new co-op or join an existing one?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup value={coopChoice} onValueChange={(value) => setCoopChoice(value as 'create' | 'join')}>
            <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800">
              <RadioGroupItem value="create" id="create-coop" />
              <div className="flex-1">
                <Label htmlFor="create-coop" className="text-base font-medium cursor-pointer">
                  Create a New Co-op/Network
                </Label>
                <p className="text-sm text-muted-foreground">
                  Start a new homeschool co-op and invite other families to join
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800">
              <RadioGroupItem value="join" id="join-coop" />
              <div className="flex-1">
                <Label htmlFor="join-coop" className="text-base font-medium cursor-pointer">
                  Join an Existing Co-op
                </Label>
                <p className="text-sm text-muted-foreground">
                  Use an invite code to join a co-op that's already been created
                </p>
              </div>
            </div>
          </RadioGroup>

          <div className="flex justify-between">
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button 
              onClick={() => {}} 
              disabled={!coopChoice}
            >
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (coopChoice === 'create') {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Create Your Homeschool Co-op</CardTitle>
          <CardDescription>Set up your co-op and become the administrator</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">Your First Name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Your Last Name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Smith"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="coopName">Co-op Name</Label>
            <Input
              id="coopName"
              value={coopName}
              onChange={(e) => setCoopName(e.target.value)}
              placeholder="Riverside Homeschool Co-op"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="families">Estimated Number of Families</Label>
            <Select value={numberOfFamilies} onValueChange={setNumberOfFamilies}>
              <SelectTrigger>
                <SelectValue placeholder="Select number of families" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1-5">1-5 families</SelectItem>
                <SelectItem value="6-10">6-10 families</SelectItem>
                <SelectItem value="11-20">11-20 families</SelectItem>
                <SelectItem value="21-50">21-50 families</SelectItem>
                <SelectItem value="50+">50+ families</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setCoopChoice('')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button onClick={handleCreateCoop} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Building className="mr-2 h-4 w-4" />
              )}
              Create Co-op & Continue to Payment
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Join existing co-op
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Join a Homeschool Co-op</CardTitle>
        <CardDescription>Enter your invite code to join an existing co-op</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">Your First Name</Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="John"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Your Last Name</Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Smith"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="joinCode">Co-op Invite Code</Label>
          <Input
            id="joinCode"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Enter your invite code"
            required
          />
          <p className="text-sm text-muted-foreground">
            Get this code from your co-op administrator
          </p>
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={() => setCoopChoice('')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={handleJoinCoop} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Join Co-op
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function HomeschoolOnboarding() {
  const router = useRouter()
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('organization_type')
  const [organizationType, setOrganizationType] = useState<OrganizationType>('')
  const [familyName, setFamilyName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [students, setStudents] = useState<Student[]>([])
  const [showStudentModal, setShowStudentModal] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  // Student form state
  const [studentFirstName, setStudentFirstName] = useState('')
  const [studentGradeLevel, setStudentGradeLevel] = useState('')

  useEffect(() => {
    checkUserState()
  }, [])

  const checkUserState = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/signup')
      return
    }
    setUserId(user.id)

    // Check if user already has an organization
    const { data: profile } = await supabase
      .from('profiles')
      .select('organisation_id, onboarding_completed, onboarding_step')
      .eq('user_id', user.id)
      .single()

    if (profile?.onboarding_completed) {
      // Redirect completed users to their dashboard
      router.push('/teach')
    } else if (profile?.onboarding_step) {
      setCurrentStep(profile.onboarding_step as OnboardingStep)
    }
  }

  const getProgress = () => {
    const steps = ['organization_type', 'teacher_info', 'add_students', 'payment', 'complete']
    const currentIndex = steps.indexOf(currentStep)
    return ((currentIndex + 1) / steps.length) * 100
  }

  const handleOrganizationTypeSubmit = async () => {
    if (!organizationType) {
      toast.error('Please select an organization type')
      return
    }

    if (organizationType === 'coop_network') {
      // Show co-op specific flow
      setCurrentStep('teacher_info')
      return
    }

    // For individual family, continue to teacher info
    setCurrentStep('teacher_info')
    
    // Update profile with organization type
    if (userId) {
      await supabase
        .from('profiles')
        .update({ onboarding_step: 'teacher_info' })
        .eq('user_id', userId)
    }
  }

  const handleTeacherInfoSubmit = async () => {
    if (!firstName || !lastName || !familyName) {
      toast.error('Please fill in all required fields')
      return
    }

    setIsLoading(true)
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      console.log('Auth check - User:', user)
      console.log('Auth check - Error:', authError)
      
      if (authError) {
        console.error('Auth error:', authError)
        throw new Error('Authentication error: ' + authError.message)
      }
      
      if (!user) {
        throw new Error('No authenticated user found. Please log in again.')
      }

      // First, ensure profile exists (create if it doesn't)
      const { data: existingProfile, error: profileCheckError } = await supabase
        .from('profiles')
        .select('user_id, organisation_id')
        .eq('user_id', user.id)
        .single()

      console.log('Existing profile check:', existingProfile, 'Error:', profileCheckError)
      
      // If profile already has an organization, skip creation
      if (existingProfile?.organisation_id) {
        console.log('Profile already has organization, skipping creation')
        setOrganizationId(existingProfile.organisation_id)
        setCurrentStep('add_students')
        return
      }
      
      // If profile doesn't exist, create it first with basic info
      if (!existingProfile) {
        console.log('Creating initial profile...')
        
        const { error: initialProfileError } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            first_name: firstName,
            last_name: lastName,
            role: 'teacher',
            active_role: 'teacher',
            onboarding_completed: false
            // username is now optional - not needed for homeschool accounts
          })
        
        if (initialProfileError) {
          console.error('Initial profile creation error:', initialProfileError)
          throw new Error(initialProfileError.message || 'Failed to create initial profile')
        }
        console.log('Initial profile created successfully')
      }

      // Step 1: Create organization first
      console.log('Creating organization...')
      
      // Generate abbreviation from family name
      const generateAbbreviation = (name: string): string => {
        // Take first letter of each word, max 4 letters
        const words = name.split(' ').filter(w => w.length > 0)
        let abbr = words.map(w => w[0].toUpperCase()).join('').slice(0, 4)
        
        // If abbreviation is too short, pad with first letters
        if (abbr.length < 2) {
          abbr = name.slice(0, 3).toUpperCase()
        }
        
        // Add random suffix to ensure uniqueness
        const suffix = Math.random().toString(36).substr(2, 3).toUpperCase()
        return `${abbr}_${suffix}`
      }
      
      const abbreviation = generateAbbreviation(familyName)
      
      const { data: org, error: orgError } = await supabase
        .from('organisations')
        .insert({
          name: familyName,
          abbr: abbreviation,
          abbreviation: abbreviation, // Both fields for compatibility
          organisation_type: 'individual_family',
          max_students: 4,
          subscription_status: 'pending'
        })
        .select()
        .single()

      if (orgError) {
        console.error('Organization creation error:', orgError)
        throw new Error(orgError.message || 'Failed to create organization')
      }
      
      console.log('Organization created:', org)
      setOrganizationId(org.id)

      // Step 2: Create organization unit
      console.log('Creating organization unit...')
      const { data: orgUnit, error: unitError } = await supabase
        .from('organisation_units')
        .insert({
          organisation_id: org.id,
          name: familyName,
          unit_type: 'family'
        })
        .select()
        .single()

      if (unitError) {
        console.error('Organization unit creation error:', unitError)
        throw new Error(unitError.message || 'Failed to create organization unit')
      }
      
      console.log('Organization unit created:', orgUnit)

      // Step 3: Create homeschool family info
      console.log('Creating family info...')
      const { data: familyInfo, error: familyError } = await supabase
        .from('homeschool_family_info')
        .insert({
          organisation_id: org.id,
          organisation_unit_id: orgUnit.id,
          family_name: familyName,
          primary_parent_id: user.id
        })
        .select()
        .single()

      if (familyError) {
        console.error('Family info creation error:', familyError)
        throw new Error(familyError.message || 'Failed to create family info')
      }
      
      console.log('Family info created:', familyInfo)

      // Step 4: Now update the profile with all the IDs
      console.log('Updating profile with organization info...')
      
      // Update the existing profile with organization details
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: firstName,
          last_name: lastName,
          organisation_id: org.id,
          organisation_unit_id: orgUnit.id,
          family_id: familyInfo.id,
          role: 'teacher',
          active_role: 'teacher',
          is_primary_parent: true,
          onboarding_step: 'add_students',
          onboarding_completed: false
        })
        .eq('user_id', user.id)

      if (profileError) {
        console.error('Profile update error:', profileError)
        throw new Error(profileError.message || 'Failed to update profile')
      }
      
      console.log('Profile updated successfully')

      setCurrentStep('add_students')
      toast.success('Family account created successfully!')
    } catch (error: any) {
      console.error('Error creating family - Full error:', error)
      console.error('Error message:', error?.message)
      console.error('Error stack:', error?.stack)
      
      // Provide more specific error message
      let errorMessage = 'Failed to create family account'
      if (error?.message) {
        errorMessage = error.message
      }
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddStudent = async () => {
    if (!studentFirstName || !studentGradeLevel) {
      toast.error('Please fill in all student information')
      return
    }

    if (students.length >= 4) {
      toast.error('Maximum 4 students allowed for standard account')
      return
    }

    const newStudent: Student = {
      id: Math.random().toString(36).substr(2, 9),
      firstName: studentFirstName,
      gradeLevel: studentGradeLevel
    }

    setStudents([...students, newStudent])
    setStudentFirstName('')
    setStudentGradeLevel('')
    setShowStudentModal(false)
    toast.success('Student added successfully!')
  }

  const handleRemoveStudent = (id: string) => {
    setStudents(students.filter(s => s.id !== id))
  }

  const handleStudentsComplete = async () => {
    if (students.length === 0) {
      toast.error('Please add at least one student')
      return
    }

    setIsLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No authenticated user')

      // Get family info
      const { data: profile } = await supabase
        .from('profiles')
        .select('family_id, organisation_id')
        .eq('user_id', user.id)
        .single()

      if (!profile?.family_id) throw new Error('No family found')

      // Create student accounts via API
      const response = await fetch('/api/auth/homeschool/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_students',
          data: {
            students: students.map(s => ({
              firstName: s.firstName,
              gradeLevel: s.gradeLevel
            })),
            familyId: profile.family_id,
            organizationId: profile.organisation_id
          }
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create students')
      }

      const result = await response.json()
      
      // Store student credentials temporarily (in production, email these to parent)
      if (result.students && result.students.length > 0) {
        console.log('Student accounts created:', result.students)
        // In production, you'd email these credentials to the parent
      }

      setCurrentStep('payment')
      toast.success('Students created successfully!')
    } catch (error: any) {
      console.error('Error creating students:', error)
      toast.error(error.message || 'Failed to create student accounts')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePayment = async () => {
    setIsLoading(true)
    try {
      const { url } = await createCheckoutSession()
      window.location.href = url
    } catch (error: any) {
      console.error('Payment error:', error)
      // Fallback to payment link
      if (userId) {
        const paymentUrl = buildPaymentLink(userId)
        window.location.href = paymentUrl
      }
    }
  }

  // Render different steps
  if (currentStep === 'organization_type') {
    if (organizationType === 'coop_network') {
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-neutral-900 dark:to-neutral-800 flex items-center justify-center p-4">
          <CoopOnboarding onBack={() => setOrganizationType('')} />
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-neutral-900 dark:to-neutral-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <Progress value={getProgress()} className="mb-4" />
            <CardTitle>Welcome to Learnology AI</CardTitle>
            <CardDescription>Let's set up your homeschool account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Choose your homeschool type:</h3>
              <RadioGroup value={organizationType} onValueChange={(value) => setOrganizationType(value as OrganizationType)}>
                <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800">
                  <RadioGroupItem value="individual_family" id="individual" />
                  <div className="flex-1 flex items-center space-x-4">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                      <Home className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <Label htmlFor="individual" className="text-base font-medium cursor-pointer">
                        Individual Family
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Perfect for a single family homeschooling their children
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800">
                  <RadioGroupItem value="coop_network" id="coop" />
                  <div className="flex-1 flex items-center space-x-4">
                    <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                      <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <Label htmlFor="coop" className="text-base font-medium cursor-pointer">
                        Homeschool Co-op/Network
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        For groups of families working together
                      </p>
                    </div>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleOrganizationTypeSubmit} disabled={!organizationType}>
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (currentStep === 'teacher_info') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-neutral-900 dark:to-neutral-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <Progress value={getProgress()} className="mb-4" />
            <CardTitle>Set Up Your Family Account</CardTitle>
            <CardDescription>Tell us about yourself and your homeschool</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="familyName">Family/Homeschool Name</Label>
              <Input
                id="familyName"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder="Smith Family Homeschool"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Your First Name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jane"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Your Last Name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Smith"
                  required
                />
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setCurrentStep('organization_type')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleTeacherInfoSubmit} disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (currentStep === 'add_students') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-neutral-900 dark:to-neutral-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <Progress value={getProgress()} className="mb-4" />
            <CardTitle>Add Your Students</CardTitle>
            <CardDescription>Create accounts for your children (max 4 students)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {students.length > 0 && (
              <div className="space-y-2">
                {students.map((student) => (
                  <div key={student.id} className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <GraduationCap className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="font-medium">{student.firstName}</p>
                        <p className="text-sm text-muted-foreground">Grade {student.gradeLevel}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveStudent(student.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {students.length < 4 && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowStudentModal(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Student
              </Button>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setCurrentStep('teacher_info')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button 
                onClick={handleStudentsComplete} 
                disabled={students.length === 0 || isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Continue to Payment
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Student Modal */}
        <Dialog open={showStudentModal} onOpenChange={setShowStudentModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Student</DialogTitle>
              <DialogDescription>Enter your student's information</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="studentFirstName">First Name</Label>
                <Input
                  id="studentFirstName"
                  value={studentFirstName}
                  onChange={(e) => setStudentFirstName(e.target.value)}
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gradeLevel">Grade Level</Label>
                <Select value={studentGradeLevel} onValueChange={setStudentGradeLevel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select grade level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="K">Kindergarten</SelectItem>
                    {[...Array(12)].map((_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>
                        Grade {i + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowStudentModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddStudent}>
                  Add Student
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  if (currentStep === 'payment') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-neutral-900 dark:to-neutral-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <Progress value={getProgress()} className="mb-4" />
            <CardTitle>Complete Your Setup</CardTitle>
            <CardDescription>Start your 7-day free trial</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">What's included:</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                  Unlimited course creation with AI
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                  Personalized learning for up to 4 students
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                  Progress tracking and gradebook
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                  Luna AI assistant for all users
                </li>
              </ul>
            </div>

            <div className="text-center">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg mb-4">
                <p className="text-lg font-semibold text-green-700 dark:text-green-300 mb-2">
                  7-Day Free Trial
                </p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  No payment needed until your trial ends
                </p>
              </div>
            </div>

            <Button 
              className="w-full" 
              size="lg"
              onClick={handlePayment}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              Start Free Trial
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              No payment required for 7 days. We'll remind you before charging.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}
