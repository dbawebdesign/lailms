'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EnhancedInput } from '@/components/ui/enhanced-input'
import { EnhancedPasswordInput } from '@/components/ui/enhanced-password-input'
import { UsernameInput } from '@/components/ui/username-input'
import { InviteCodeCopyButton } from '@/components/ui/copy-button'
import TermsCheckbox from '../ui/terms-checkbox'
import { toast } from '@/components/ui/use-toast'
import { Loader2, CheckCircle, GraduationCap, Home } from 'lucide-react'
import { useInviteCodeClipboard } from '@/hooks/useClipboard'
import Image from 'next/image'
import { buildPaymentLink } from '@/lib/stripe/config'

interface CoopFamilySignupFormProps {
  inviteCode: string
  organizationName: string
  onBack: () => void
}

interface SignupFormData {
  familyName: string
  primaryParentInfo: {
    username: string
    firstName: string
    lastName: string
    password: string
    confirmPassword: string
  }
  agreedToTerms: boolean
}

interface SignupResult {
  success: boolean
  family: {
    id: string
    name: string
    organization_id: string
    organization_name: string
  }
  primaryParent: {
    id: string
    username: string
    email: string
    roles: string[]
  }
  inviteCodes: Array<{
    code: string
    role: string
  }>
  nextSteps: string[]
}

export default function CoopFamilySignupForm({ 
  inviteCode, 
  organizationName, 
  onBack 
}: CoopFamilySignupFormProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [signupResult, setSignupResult] = useState<SignupResult | null>(null)
  const { copy: copyToClipboard } = useInviteCodeClipboard()
  
  const [formData, setFormData] = useState<SignupFormData>({
    familyName: '',
    primaryParentInfo: {
      username: '',
      firstName: '',
      lastName: '',
      password: '',
      confirmPassword: ''
    },
    agreedToTerms: false
  })

  // Validation states
  const [validationStates, setValidationStates] = useState({
    familyName: { isValid: false, errors: [] as string[] },
    firstName: { isValid: false, errors: [] as string[] },
    lastName: { isValid: false, errors: [] as string[] },
    username: { isValid: false, errors: [] as string[] },
    password: { isValid: false, errors: [] as string[] },
    confirmPassword: { isValid: false, errors: [] as string[] }
  })

  const updateFormData = (updates: Partial<SignupFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }))
  }

  const updateParentInfo = (updates: Partial<SignupFormData['primaryParentInfo']>) => {
    setFormData(prev => ({
      ...prev,
      primaryParentInfo: { ...prev.primaryParentInfo, ...updates }
    }))
  }

  // Validation handlers
  const updateValidationState = useCallback((field: keyof typeof validationStates, isValid: boolean, errors: string[]) => {
    setValidationStates(prev => ({
      ...prev,
      [field]: { isValid, errors }
    }))
  }, [])

  // Memoized validation rules
  const familyNameValidationRules = useMemo(() => [
    { test: (value: string) => value.trim().length >= 3, message: 'Family name must be at least 3 characters' },
    { test: (value: string) => /^[a-zA-Z\s'-]+$/.test(value), message: 'Family name can only contain letters, spaces, hyphens, and apostrophes' }
  ], [])

  const nameValidationRules = useMemo(() => [
    { test: (value: string) => value.trim().length >= 2, message: 'Name must be at least 2 characters' },
    { test: (value: string) => /^[a-zA-Z\s'-]+$/.test(value), message: 'Name can only contain letters, spaces, hyphens, and apostrophes' }
  ], [])

  // Check if form is ready for submission
  const isFormValid = () => {
    const requiredFields = ['familyName', 'firstName', 'lastName', 'username', 'password', 'confirmPassword']
    return requiredFields.every(field => validationStates[field as keyof typeof validationStates]?.isValid) && formData.agreedToTerms
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      // Enhanced validation with specific error messages
      if (!isFormValid()) {
        const fieldErrors = Object.entries(validationStates)
          .filter(([_, state]) => !state.isValid && state.errors.length > 0)
          .map(([field, state]) => `${field}: ${state.errors[0]}`)
        
        if (fieldErrors.length > 0) {
          toast({
            title: "Validation Error",
            description: `Please fix the following errors: ${fieldErrors.join(', ')}`,
            variant: "destructive"
          })
        } else if (!formData.agreedToTerms) {
          toast({
            title: "Error",
            description: "You must agree to the Terms of Service to create an account",
            variant: "destructive"
          })
        } else {
          toast({
            title: "Error",
            description: "Please complete all required fields",
            variant: "destructive"
          })
        }
        return
      }

      const response = await fetch('/api/auth/coop-family-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteCode,
          familyName: formData.familyName,
          primaryParentInfo: {
            username: formData.primaryParentInfo.username,
            firstName: formData.primaryParentInfo.firstName,
            lastName: formData.primaryParentInfo.lastName,
            password: formData.primaryParentInfo.password
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create family')
      }

      const result = await response.json()
      setSignupResult(result)
      
      // Move to success step
      setCurrentStep(2)

    } catch (error) {
      console.error('Family signup error:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to create family',
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
              <h2 className="text-2xl font-semibold">Join {organizationName}</h2>
              <p className="text-neutral-600 dark:text-neutral-400">
                Set up your family within this homeschool co-op
              </p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <EnhancedInput
                id="familyName"
                label="Family Name"
                value={formData.familyName}
                onChange={(e) => updateFormData({ familyName: e.target.value })}
                placeholder="e.g., The Smith Family"
                required
                disabled={isLoading}
                validationRules={familyNameValidationRules}
                onValidationChange={(isValid, errors) => updateValidationState('familyName', isValid, errors)}
              />

              <div className="space-y-4">
                <h3 className="font-medium">Primary Parent/Guardian Information</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <EnhancedInput
                    id="firstName"
                    label="First Name"
                    value={formData.primaryParentInfo.firstName}
                    onChange={(e) => updateParentInfo({ firstName: e.target.value })}
                    placeholder="Enter your first name"
                    required
                    disabled={isLoading}
                    validationRules={nameValidationRules}
                    onValidationChange={(isValid, errors) => updateValidationState('firstName', isValid, errors)}
                  />
                  
                  <EnhancedInput
                    id="lastName"
                    label="Last Name"
                    value={formData.primaryParentInfo.lastName}
                    onChange={(e) => updateParentInfo({ lastName: e.target.value })}
                    placeholder="Enter your last name"
                    required
                    disabled={isLoading}
                    validationRules={nameValidationRules}
                    onValidationChange={(isValid, errors) => updateValidationState('lastName', isValid, errors)}
                  />
                </div>

                <UsernameInput
                  id="username"
                  value={formData.primaryParentInfo.username}
                  onChange={(e) => updateParentInfo({ username: e.target.value })}
                  required
                  disabled={isLoading}
                  onValidationChange={(isValid, errors) => updateValidationState('username', isValid, errors)}
                />

                <EnhancedPasswordInput
                  id="password"
                  label="Password"
                  value={formData.primaryParentInfo.password}
                  onChange={(e) => updateParentInfo({ password: e.target.value })}
                  required
                  disabled={isLoading}
                  showStrengthIndicator={true}
                  minLength={8}
                  onValidationChange={(isValid, errors) => updateValidationState('password', isValid, errors)}
                />

                <EnhancedPasswordInput
                  id="confirmPassword"
                  label="Confirm Password"
                  value={formData.primaryParentInfo.confirmPassword}
                  onChange={(e) => updateParentInfo({ confirmPassword: e.target.value })}
                  placeholder="Confirm your password"
                  required
                  disabled={isLoading}
                  showStrengthIndicator={false}
                  confirmValue={formData.primaryParentInfo.password}
                  onValidationChange={(isValid, errors) => updateValidationState('confirmPassword', isValid, errors)}
                />

                <TermsCheckbox
                  checked={formData.agreedToTerms}
                  onCheckedChange={(checked: boolean) => updateFormData({ agreedToTerms: checked })}
                  disabled={isLoading}
                />
              </div>

              <div className="flex space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onBack}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading || !isFormValid()}
                  className="flex-1"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating Family...
                    </>
                  ) : (
                    'Create Family'
                  )}
                </Button>
              </div>
            </form>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold">🎉 Welcome to {organizationName}!</h2>
                <p className="text-neutral-600 dark:text-neutral-400">
                  Your family has been successfully added to the co-op.
                </p>
              </div>
            </div>

            {signupResult && (
              <div className="space-y-6">
                {/* Family Info */}
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    {signupResult.family.name}
                  </h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Username: {signupResult.primaryParent.username}
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    You have {signupResult.primaryParent.roles.join(', ')} access
                  </p>
                </div>

                {/* Student Invite Codes */}
                <div className="bg-neutral-50 dark:bg-neutral-800 p-4 rounded-lg">
                  <h3 className="font-semibold mb-4">Your Student Invite Codes</h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                    Use these codes to invite your children to join your family:
                  </p>
                  
                  <div className="space-y-3">
                    {signupResult.inviteCodes
                      .filter(code => code.role === 'student')
                      .map((inviteCode, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-white dark:bg-neutral-700 rounded border">
                        <div className="flex items-center space-x-3">
                          <GraduationCap className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <div>
                            <code className="font-mono text-sm font-semibold">{inviteCode.code}</code>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">Student invite code</p>
                          </div>
                        </div>
                        <InviteCodeCopyButton
                          code={inviteCode.code}
                          description="Student invite code"
                          onCopy={async (code, description) => {
                            copyToClipboard(code, description || 'Student invite code')
                            return true
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Next Steps */}
                <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg">
                  <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">Next Steps</h3>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-amber-800 dark:text-amber-200">
                    <li>Share student invite codes with your children</li>
                    <li>Help them create their accounts using the codes</li>
                    <li>Create your first Base Class and class instance</li>
                    <li>Send your children the invite code to enroll in the class and start learning!</li>
                  </ol>
                </div>

                <div className="flex space-x-3">
                  <Button 
                    onClick={() => {
                      // Redirect to Stripe payment link
                      const paymentUrl = buildPaymentLink(signupResult.primaryParent.id)
                      window.location.href = paymentUrl
                    }}
                    className="flex-1"
                  >
                    Continue to Payment
                  </Button>
                </div>
              </div>
            )}
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-neutral-900 dark:to-neutral-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-6">
          <div className="text-center space-y-4">
            <div className="flex justify-center mb-6">
              <Image 
                src="/Horizontal black text.png"
                alt="Learnology AI Logo"
                width={250}
                height={67}
                priority
                className="dark:hidden"
              />
              <Image 
                src="/Horizontal white text.png"
                alt="Learnology AI Logo"
                width={250}
                height={67}
                priority
                className="hidden dark:block"
              />
            </div>
            <CardTitle className="text-3xl">Join Co-op Family</CardTitle>
            <p className="text-neutral-600 dark:text-neutral-400">
              Create your family within {organizationName}
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {renderStep()}
        </CardContent>
      </Card>
    </div>
  )
} 