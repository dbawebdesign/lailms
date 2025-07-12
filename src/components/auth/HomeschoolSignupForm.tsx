'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { InviteCodeCopyButton } from '@/components/ui/copy-button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/components/ui/use-toast'
import { Loader2, Users, Home, ArrowRight, CheckCircle, UserPlus, GraduationCap, Building, User } from 'lucide-react'
import { useInviteCodeClipboard } from '@/hooks/useClipboard'

type HomeschoolType = 'individual_family' | 'coop_network' | ''

interface SignupFormData {
  organizationType: HomeschoolType
  organizationName: string
  abbreviation: string
  familyName?: string
  primaryContactInfo: {
    username: string
    firstName: string
    lastName: string
    password: string
    confirmPassword: string
  }
}

interface InviteCode {
  code: string
  role: string
}

interface OrganizationResult {
  organization: {
    id: string
    name: string
    type: HomeschoolType
    abbreviation: string
  }
  primaryContact: {
    id: string
    username: string
    email: string
    roles: string[]
  }
  inviteCodes: InviteCode[]
  nextSteps: string[]
}

const steps = [
  { id: 1, title: 'Organization Type', description: 'Choose your homeschool structure' },
  { id: 2, title: 'Organization Details', description: 'Set up your organization' },
  { id: 3, title: 'Primary Contact', description: 'Create your account' },
  { id: 4, title: 'Complete', description: 'Setup successful' }
]

const CoopSuccessContent = ({ result, onCopy }: { result: OrganizationResult, onCopy: (code: string, role: string) => void }) => {
  const adminCode = result.inviteCodes.find(c => c.role === 'admin')
  
  const handleCopy = async (code: string, description?: string) => {
    onCopy(code, description || 'invite code')
    return true
  }
  
  return (
    <div className="space-y-6">
      <div className="bg-neutral-50 dark:bg-neutral-800 p-4 rounded-lg">
        <div className="flex items-center space-x-2 mb-4">
          <UserPlus className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
          <h3 className="font-semibold">Your Co-op Admin Invite Code</h3>
        </div>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
          Share this code with parents/teachers to allow them to join your co-op and manage their own families.
        </p>
        <div className="space-y-3">
          {adminCode ? (
            <div className="flex items-center justify-between p-3 bg-white dark:bg-neutral-700 rounded border">
              <div className="flex items-center space-x-3">
                <Building className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <div>
                  <code className="font-mono text-sm font-semibold">{adminCode.code}</code>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Co-op Admin/Parent invite code</p>
                </div>
              </div>
              <InviteCodeCopyButton
                code={adminCode.code}
                description="Co-op Admin invite code"
                onCopy={handleCopy}
              />
            </div>
          ) : (
             <p className="text-sm text-red-500">Admin invite code not found. Please contact support.</p>
          )}
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg">
        <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">Next Steps</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm text-amber-800 dark:text-amber-200">
          <li>Share the Co-op Admin invite code with the parents/teachers in your co-op.</li>
          <li>They will use this code to create accounts and set up their own family units.</li>
          <li>Once joined, they will receive their own codes to invite their students (children).</li>
          <li>Start creating shared courses and lessons in your dashboard for the co-op.</li>
          <li>Explore the knowledge base and teaching tools.</li>
        </ol>
      </div>
    </div>
  )
}

const FamilySuccessContent = ({ result, onCopy }: { result: OrganizationResult, onCopy: (code: string, role: string) => void }) => {
  const studentCode = result.inviteCodes.find(c => c.role === 'student')
  
  const handleCopy = async (code: string, description?: string) => {
    onCopy(code, description || 'invite code')
    return true
  }
  
  return (
    <div className="space-y-6">
      <div className="bg-neutral-50 dark:bg-neutral-800 p-4 rounded-lg">
        <div className="flex items-center space-x-2 mb-4">
          <UserPlus className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
          <h3 className="font-semibold">Your Student Invite Code</h3>
        </div>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
          Use this code to invite students (your children) to join your homeschool:
        </p>
        <div className="space-y-3">
          {studentCode ? (
            <div className="flex items-center justify-between p-3 bg-white dark:bg-neutral-700 rounded border">
              <div className="flex items-center space-x-3">
                <GraduationCap className="h-4 w-4 text-green-600 dark:text-green-400" />
                <div>
                  <code className="font-mono text-sm font-semibold">{studentCode.code}</code>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Student invite code</p>
                </div>
              </div>
              <InviteCodeCopyButton
                code={studentCode.code}
                description="Student invite code"
                onCopy={handleCopy}
              />
            </div>
          ) : (
            <p className="text-sm text-red-500">Student invite code not found. Please contact support.</p>
          )}
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg">
        <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">Next Steps</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm text-amber-800 dark:text-amber-200">
          <li>Share the student invite code with your children.</li>
          <li>Help them create their accounts using the code.</li>
          <li>Start creating courses and lessons in your dashboard.</li>
          <li>Explore the knowledge base and teaching tools.</li>
        </ol>
      </div>
    </div>
  )
}

export default function HomeschoolSignupForm() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [organizationResult, setOrganizationResult] = useState<OrganizationResult | null>(null)
  const { copy: copyToClipboard } = useInviteCodeClipboard()
  const [formData, setFormData] = useState<SignupFormData>({
    organizationType: '',
    organizationName: '',
    abbreviation: '',
    familyName: '',
    primaryContactInfo: {
      username: '',
      firstName: '',
      lastName: '',
      password: '',
      confirmPassword: ''
    }
  })

  const updateFormData = (updates: Partial<SignupFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }))
  }

  const updateContactInfo = (updates: Partial<SignupFormData['primaryContactInfo']>) => {
    setFormData(prev => ({
      ...prev,
      primaryContactInfo: { ...prev.primaryContactInfo, ...updates }
    }))
  }

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(prev => prev + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1)
    }
  }



  const handleSubmit = async () => {
    console.log('handleSubmit called')
    console.log('Form data:', formData)
    console.log('canProceed():', canProceed())
    
    setIsLoading(true)
    
    try {
      // Validate passwords match
      if (formData.primaryContactInfo.password !== formData.primaryContactInfo.confirmPassword) {
        toast({
          title: "Error",
          description: "Passwords do not match",
          variant: "destructive"
        })
        setIsLoading(false)
        return
      }

      // Generate abbreviation from organization name if not provided
      const abbreviation = formData.abbreviation || 
        formData.organizationName.split(' ').map(word => word.charAt(0).toUpperCase()).join('')

      const response = await fetch('/api/auth/homeschool/create-organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationType: formData.organizationType,
          organizationName: formData.organizationName,
          abbreviation,
          familyName: formData.familyName,
          primaryContactInfo: {
            username: formData.primaryContactInfo.username,
            firstName: formData.primaryContactInfo.firstName,
            lastName: formData.primaryContactInfo.lastName,
            password: formData.primaryContactInfo.password
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create organization')
      }

      const result = await response.json()
      setOrganizationResult(result)
      
      // Move to success step
      setCurrentStep(4)

    } catch (error) {
      console.error('Signup error:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to create organization',
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold">Choose Your Homeschool Structure</h2>
              <p className="text-neutral-600 dark:text-neutral-400">
                Select the option that best describes your homeschool organization
              </p>
            </div>
            
            <RadioGroup
              value={formData.organizationType}
              onValueChange={(value) => updateFormData({ organizationType: value as HomeschoolType })}
              className="space-y-4"
            >
              <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                <RadioGroupItem value="individual_family" id="individual" />
                <div className="flex-1 flex items-center space-x-4">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                    <Home className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <Label htmlFor="individual" className="text-base font-medium">
                      Individual Family
                    </Label>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      A single family homeschooling their children
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                <RadioGroupItem value="coop_network" id="coop" />
                <div className="flex-1 flex items-center space-x-4">
                  <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                    <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <Label htmlFor="coop" className="text-base font-medium">
                      Homeschool Co-op / Network
                    </Label>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      A group of families working together
                    </p>
                  </div>
                </div>
              </div>
            </RadioGroup>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold">Organization Details</h2>
              <p className="text-neutral-600 dark:text-neutral-400">
                Set up your {formData.organizationType === 'individual_family' ? 'family' : 'co-op'} organization
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="orgName">
                  {formData.organizationType === 'individual_family' ? 'Family Name' : 'Co-op Name'}
                </Label>
                <Input
                  id="orgName"
                  value={formData.organizationName}
                  onChange={(e) => updateFormData({ organizationName: e.target.value })}
                  placeholder={formData.organizationType === 'individual_family' 
                    ? 'e.g., Smith Family Homeschool' 
                    : 'e.g., Riverside Homeschool Co-op'
                  }
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="abbreviation">Abbreviation (Optional)</Label>
                <Input
                  id="abbreviation"
                  value={formData.abbreviation}
                  onChange={(e) => updateFormData({ abbreviation: e.target.value })}
                  placeholder="e.g., SFH or RHC"
                  className="mt-1"
                />
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                  Used for generating unique codes. Leave blank to auto-generate.
                </p>
              </div>

              {formData.organizationType === 'individual_family' && (
                <div>
                  <Label htmlFor="familyName">Family Name (Optional)</Label>
                  <Input
                    id="familyName"
                    value={formData.familyName}
                    onChange={(e) => updateFormData({ familyName: e.target.value })}
                    placeholder="e.g., The Smith Family"
                    className="mt-1"
                  />
                </div>
              )}
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold">Create Your Account</h2>
              <p className="text-neutral-600 dark:text-neutral-400">
                Set up your primary contact and admin account
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={formData.primaryContactInfo.firstName}
                    onChange={(e) => updateContactInfo({ firstName: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={formData.primaryContactInfo.lastName}
                    onChange={(e) => updateContactInfo({ lastName: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={formData.primaryContactInfo.username}
                  onChange={(e) => updateContactInfo({ username: e.target.value })}
                  placeholder="Choose a unique username"
                  className="mt-1"
                />
              </div>

              <PasswordInput
                id="password"
                label="Password"
                value={formData.primaryContactInfo.password}
                onChange={(e) => updateContactInfo({ password: e.target.value })}
                placeholder="Enter your password"
              />

              <PasswordInput
                id="confirmPassword"
                label="Confirm Password"
                value={formData.primaryContactInfo.confirmPassword}
                onChange={(e) => updateContactInfo({ confirmPassword: e.target.value })}
                placeholder="Confirm your password"
              />
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold">🎉 Welcome to Learnology!</h2>
                <p className="text-neutral-600 dark:text-neutral-400">
                  Your {organizationResult?.organization.type === 'individual_family' ? 'family homeschool' : 'homeschool co-op'} has been created successfully.
                </p>
              </div>
            </div>

            {organizationResult && (
              <div className="space-y-6">
                {/* Organization Info */}
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    {organizationResult.organization.name}
                  </h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Username: {organizationResult.primaryContact.username}
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    You have {organizationResult.primaryContact.roles.join(', ')} access
                  </p>
                </div>

                {organizationResult.organization.type === 'coop_network' ? (
                  <CoopSuccessContent result={organizationResult} onCopy={copyToClipboard} />
                ) : (
                  <FamilySuccessContent result={organizationResult} onCopy={copyToClipboard} />
                )}

                <div className="flex space-x-3">
                  <Button 
                    onClick={() => router.push('/login')}
                    className="flex-1"
                  >
                    Sign In to Dashboard
                  </Button>
                </div>
              </div>
            )}
          </div>
        )
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.organizationType !== ''
      case 2:
        return formData.organizationName.trim() !== ''
      case 3:
        return (
          formData.primaryContactInfo.firstName.trim() !== '' &&
          formData.primaryContactInfo.lastName.trim() !== '' &&
          formData.primaryContactInfo.username.trim() !== '' &&
          formData.primaryContactInfo.password.trim() !== '' &&
          formData.primaryContactInfo.confirmPassword.trim() !== ''
        )
      default:
        return true
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-neutral-900 dark:to-neutral-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-6">
          <div className="text-center space-y-2">
            <CardTitle className="text-3xl">Welcome to Learnology</CardTitle>
            <p className="text-neutral-600 dark:text-neutral-400">
              Set up your homeschool organization
            </p>
          </div>

          {/* Progress Steps */}
          <div className="flex justify-between items-center">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  ${currentStep >= step.id 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400'
                  }
                `}>
                  {currentStep > step.id ? '✓' : step.id}
                </div>
                {index < steps.length - 1 && (
                  <div className={`
                    w-12 h-0.5 mx-2
                    ${currentStep > step.id ? 'bg-blue-600' : 'bg-neutral-200 dark:bg-neutral-700'}
                  `} />
                )}
              </div>
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {renderStep()}

          {currentStep < 4 && (
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1}
              >
                Back
              </Button>
              
              {currentStep === 3 ? (
                <Button
                  onClick={handleSubmit}
                  disabled={!canProceed() || isLoading}
                  className="min-w-32"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Create Organization'
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  disabled={!canProceed()}
                  className="min-w-24"
                >
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 