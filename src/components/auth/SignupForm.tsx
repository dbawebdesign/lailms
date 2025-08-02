'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
// import { Button } from '@learnologyai/ui' // Temporarily comment out
import { Input } from '@/components/ui/input'
import { EnhancedInput } from '@/components/ui/enhanced-input'
import { EnhancedPasswordInput } from '@/components/ui/enhanced-password-input'
import { UsernameInput } from '@/components/ui/username-input'
import TermsCheckbox from '../ui/terms-checkbox'
import { toast } from 'sonner'
import CoopFamilySignupForm from './CoopFamilySignupForm'
import { buildPaymentLink } from '@/lib/stripe/config'

interface InviteCodeData {
  valid: boolean
  role: string
  organisation: {
    id: string
    name: string
    type: string
    isHomeschoolCoop: boolean
    isIndividualFamily: boolean
  }
}

export default function SignupForm() {
  const router = useRouter()

  // State for 2-step process
  const [step, setStep] = useState(1)
  const [inviteCode, setInviteCode] = useState('')
  const [inviteCodeData, setInviteCodeData] = useState<InviteCodeData | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  // Form fields for step 2
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [gradeLevel, setGradeLevel] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  
  // Validation states
  const [validationStates, setValidationStates] = useState({
    firstName: { isValid: false, errors: [] as string[] },
    lastName: { isValid: false, errors: [] as string[] },
    username: { isValid: false, errors: [] as string[] },
    password: { isValid: false, errors: [] as string[] },
    confirmPassword: { isValid: false, errors: [] as string[] },
    gradeLevel: { isValid: true, errors: [] as string[] } // Optional field
  })

  // Validation handlers
  const updateValidationState = useCallback((field: keyof typeof validationStates, isValid: boolean, errors: string[]) => {
    setValidationStates(prev => ({
      ...prev,
      [field]: { isValid, errors }
    }))
  }, [])

  // Memoized validation rules
  const nameValidationRules = useMemo(() => [
    { test: (value: string) => value.trim().length >= 2, message: 'Name must be at least 2 characters' },
    { test: (value: string) => /^[a-zA-Z\s'-]+$/.test(value), message: 'Name can only contain letters, spaces, hyphens, and apostrophes' }
  ], [])

  const gradeLevelValidationRules = useMemo(() => [
    { test: (value: string) => !value || /^(K|[1-9]|1[0-2])$/.test(value.trim()), message: 'Please enter a valid grade level (K, 1-12)' }
  ], [])

  // Check if form is ready for submission
  const isFormValid = () => {
    const requiredFields = ['firstName', 'lastName', 'username', 'password', 'confirmPassword']
    return requiredFields.every(field => validationStates[field as keyof typeof validationStates]?.isValid) && agreedToTerms
  }

  // Step 1: Verify invite code
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      // Trim any whitespace from the invite code
      const trimmedCode = inviteCode.trim()
      setInviteCode(trimmedCode) // Update state with trimmed code
      
      const response = await fetch('/api/invite-code/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmedCode }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify invite code')
      }

      console.log('[SignupForm] Verified invite code:', trimmedCode)
      setInviteCodeData(data)
      
      // Check if this is a co-op admin code - if so, show co-op family signup
      if (data.organisation?.isHomeschoolCoop && data.role === 'admin') {
        setStep(3) // Co-op family signup
      } else {
        setStep(2) // Regular signup
      }
      
      setIsLoading(false) // Reset loading state for step 2
    } catch (error) {
      setIsLoading(false)
      // Assert error type
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
      toast.error(`Invite code verification failed: ${errorMessage}`)
    }
  }

  // Handle going back to step 1
  const handleBack = () => {
    setStep(1)
    setInviteCodeData(null)
    setError('')
  }

  // Step 2: Submit signup form
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    // Enhanced validation with specific error messages
    if (!isFormValid()) {
      const fieldErrors = Object.entries(validationStates)
        .filter(([_, state]) => !state.isValid && state.errors.length > 0)
        .map(([field, state]) => `${field}: ${state.errors[0]}`)
      
      if (fieldErrors.length > 0) {
        setError(`Please fix the following errors: ${fieldErrors.join(', ')}`)
      } else if (!agreedToTerms) {
        setError('You must agree to the Terms of Service to create an account')
      } else {
        setError('Please complete all required fields')
      }
      setIsLoading(false)
      return
    }

    try {
      const formData = {
        inviteCode,
        username,
        password,
        firstName,
        lastName,
        gradeLevel,
      }

      console.log('[SignupForm] Submitting formData:', formData); // Debug log

      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      console.log('[SignupForm] Fetch response:', response); // Debug log

      if (!response.ok) {
        const errorData = await response.json()
        console.error('[SignupForm] Signup failed:', errorData); // Debug log
        
        // Provide user-friendly error messages
        let userFriendlyError = 'Signup failed. Please try again.'
        if (errorData.error) {
          if (errorData.error.includes('Username is already taken')) {
            userFriendlyError = 'This username is already taken. Please choose a different one.'
          } else if (errorData.error.includes('Invalid invite code')) {
            userFriendlyError = 'The invite code is invalid or has expired. Please check with your organization.'
          } else if (errorData.error.includes('Missing required fields')) {
            userFriendlyError = 'Please fill in all required fields.'
          } else if (errorData.error.includes('Organisation not found')) {
            userFriendlyError = 'Organization not found. Please contact support.'
          } else {
            userFriendlyError = errorData.error
          }
        }
        
        setError(userFriendlyError)
        setIsLoading(false)
        return
      }

      const responseData = await response.json()
      console.log('[SignupForm] Signup successful:', responseData); // Debug log

      // Check if payment is required
      if (responseData.user?.requiresPayment) {
        // Redirect to Stripe payment link
        const paymentUrl = buildPaymentLink(responseData.user.id)
        console.log('[SignupForm] Redirecting to payment:', paymentUrl)
        window.location.href = paymentUrl // Use window.location for external redirect
      } else {
        // Redirect to login page on success (for users who don't need payment)
        router.push('/login?registered=true')
      }
    } catch (error) {
      console.error('[SignupForm] Network or other error during signup:', error); // Debug log
      setError('An unexpected error occurred. Please try again.')
      setIsLoading(false)
    }
  }

  // Render Step 1: Invite Code Verification
  if (step === 1) {
    return (
      <div className="w-full max-w-md p-8 bg-white dark:bg-neutral-900 rounded-xl shadow-2xl dark:shadow-neutral-950/50">
        <div className="flex justify-center mb-8">
          <Image 
            src="/Horizontal black text.png"
            alt="Learnology AI Logo"
            width={200}
            height={53}
            priority
            className="dark:hidden"
          />
          <Image 
            src="/Horizontal white text.png"
            alt="Learnology AI Logo"
            width={200}
            height={53}
            priority
            className="hidden dark:block"
          />
        </div>
        <h2 className="text-3xl font-semibold mb-6 text-center text-neutral-800 dark:text-neutral-100">Create Account</h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-6 text-center">
          Enter your invite code to get started
        </p>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 dark:bg-red-800/30 dark:text-red-300 rounded-md">
            {error}
          </div>
        )}
        
        <form onSubmit={handleVerifyCode}>
          <div className="mb-5">
            <label htmlFor="inviteCode" className="block text-sm font-normal text-neutral-700 dark:text-neutral-400 mb-1.5">
              Invite Code
            </label>
            <Input
              id="inviteCode"
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="w-full p-3 bg-transparent border border-neutral-300 dark:border-neutral-700 rounded-lg focus:ring-1 focus:ring-neutral-500 dark:focus:ring-neutral-500 dark:text-neutral-100 placeholder-neutral-500 dark:placeholder-neutral-500 dark:bg-neutral-800"
              required
              placeholder="Enter your invite code"
              disabled={isLoading}
            />
          </div>
          
          <button
            type="submit"
            className="w-full mt-8 py-3 px-4 bg-neutral-800 text-neutral-100 font-semibold rounded-lg hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300 dark:focus:ring-offset-black dark:focus:ring-neutral-500 disabled:opacity-50 transition-colors duration-150"
            disabled={isLoading}
          >
            {isLoading ? 'Verifying...' : 'Continue'}
          </button>
        </form>
      </div>
    )
  }

  // Render Step 2: Account Creation
  if (step === 2) {
    return (
      <div className="w-full max-w-md p-8 bg-white dark:bg-neutral-900 rounded-xl shadow-2xl dark:shadow-neutral-950/50">
        <div className="flex justify-center mb-6">
          <Image 
            src="/Horizontal black text.png"
            alt="Learnology AI Logo"
            width={200}
            height={53}
            priority
            className="dark:hidden"
          />
          <Image 
            src="/Horizontal white text.png"
            alt="Learnology AI Logo"
            width={200}
            height={53}
            priority
            className="hidden dark:block"
          />
        </div>
        <h2 className="text-3xl font-semibold mb-2 text-center text-neutral-800 dark:text-neutral-100">Create Your Account</h2>
        
        {inviteCodeData && (
          <p className="text-green-600 dark:text-green-400 mb-6 text-center text-sm">
            Welcome to {inviteCodeData.organisation.name}! You're signing up as a {inviteCodeData.role}.
          </p>
        )}
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 dark:bg-red-800/30 dark:text-red-300 rounded-md">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSignup} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <EnhancedInput
              id="firstName"
              label="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Enter your first name"
              required
              disabled={isLoading}
              validationRules={nameValidationRules}
              onValidationChange={(isValid, errors) => updateValidationState('firstName', isValid, errors)}
            />
            
            <EnhancedInput
              id="lastName"
              label="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Enter your last name"
              required
              disabled={isLoading}
              validationRules={nameValidationRules}
              onValidationChange={(isValid, errors) => updateValidationState('lastName', isValid, errors)}
            />
          </div>
          
          <UsernameInput
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={isLoading}
            onValidationChange={(isValid, errors) => updateValidationState('username', isValid, errors)}
          />
          
          <EnhancedPasswordInput
            id="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
            showStrengthIndicator={true}
            minLength={8}
            onValidationChange={(isValid, errors) => updateValidationState('password', isValid, errors)}
          />
          
          <EnhancedPasswordInput
            id="confirmPassword"
            label="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your password"
            required
            disabled={isLoading}
            showStrengthIndicator={false}
            confirmValue={password}
            onValidationChange={(isValid, errors) => updateValidationState('confirmPassword', isValid, errors)}
          />
          
          {inviteCodeData?.role === 'student' && (
            <EnhancedInput
              id="gradeLevel"
              label="Grade Level"
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              placeholder="e.g., 9, 10, 11, 12"
              disabled={isLoading}
              validationRules={gradeLevelValidationRules}
              onValidationChange={(isValid, errors) => updateValidationState('gradeLevel', isValid, errors)}
              helperText="Enter your current grade level (K for Kindergarten, 1-12 for grades)"
            />
          )}

          <TermsCheckbox
            checked={agreedToTerms}
            onCheckedChange={setAgreedToTerms}
            disabled={isLoading}
            error={error && !agreedToTerms ? 'You must agree to the Terms of Service' : undefined}
          />
          
          <button
            type="submit"
            className="w-full mt-8 py-3 px-4 bg-neutral-800 text-neutral-100 font-semibold rounded-lg hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300 dark:focus:ring-offset-black dark:focus:ring-neutral-500 disabled:opacity-50 transition-colors duration-150"
            disabled={isLoading || !isFormValid()}
          >
            {isLoading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>
      </div>
    )
  }

  // Render Step 3: Co-op Family Signup
  if (step === 3) {
    return (
      <CoopFamilySignupForm
        inviteCode={inviteCode}
        organizationName={inviteCodeData?.organisation.name || 'Homeschool Co-op'}
        onBack={handleBack}
      />
    )
  }

  return null; // Should not happen if steps are handled correctly
} 