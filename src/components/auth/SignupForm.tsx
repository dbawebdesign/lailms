'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
// import { Button } from '@learnologyai/ui' // Temporarily comment out
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { toast } from 'sonner'
import CoopFamilySignupForm from './CoopFamilySignupForm'

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

    // Basic validation
    if (password !== confirmPassword) {
      setError('Passwords do not match')
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
        setError(errorData.error || 'Signup failed. Please try again.')
        setIsLoading(false)
        return
      }

      // Redirect to login page on success
      router.push('/login?registered=true')
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
            <div>
              <label htmlFor="firstName" className="block text-sm font-normal text-neutral-700 dark:text-neutral-400 mb-1.5">
                First Name
              </label>
              <Input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full p-3 bg-transparent border border-neutral-300 dark:border-neutral-700 rounded-lg focus:ring-1 focus:ring-neutral-500 dark:focus:ring-neutral-500 dark:text-neutral-100 placeholder-neutral-500 dark:placeholder-neutral-500 dark:bg-neutral-800"
                required
                disabled={isLoading}
              />
            </div>
            
            <div>
              <label htmlFor="lastName" className="block text-sm font-normal text-neutral-700 dark:text-neutral-400 mb-1.5">
                Last Name
              </label>
              <Input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full p-3 bg-transparent border border-neutral-300 dark:border-neutral-700 rounded-lg focus:ring-1 focus:ring-neutral-500 dark:focus:ring-neutral-500 dark:text-neutral-100 placeholder-neutral-500 dark:placeholder-neutral-500 dark:bg-neutral-800"
                required
                disabled={isLoading}
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="username" className="block text-sm font-normal text-neutral-700 dark:text-neutral-400 mb-1.5">
              Username
            </label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-3 bg-transparent border border-neutral-300 dark:border-neutral-700 rounded-lg focus:ring-1 focus:ring-neutral-500 dark:focus:ring-neutral-500 dark:text-neutral-100 placeholder-neutral-500 dark:placeholder-neutral-500 dark:bg-neutral-800"
              required
              disabled={isLoading}
            />
          </div>
          
          <PasswordInput
            id="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 bg-transparent border border-neutral-300 dark:border-neutral-700 rounded-lg focus:ring-1 focus:ring-neutral-500 dark:focus:ring-neutral-500 dark:text-neutral-100 placeholder-neutral-500 dark:placeholder-neutral-500 dark:bg-neutral-800"
            required={true}
            disabled={isLoading}
            placeholder="Enter your password (min 8 characters)"
          />
          
          <PasswordInput
            id="confirmPassword"
            label="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full p-3 bg-transparent border border-neutral-300 dark:border-neutral-700 rounded-lg focus:ring-1 focus:ring-neutral-500 dark:focus:ring-neutral-500 dark:text-neutral-100 placeholder-neutral-500 dark:placeholder-neutral-500 dark:bg-neutral-800"
            required={true}
            disabled={isLoading}
            placeholder="Confirm your password"
          />
          
          {inviteCodeData?.role === 'student' && (
            <div>
              <label htmlFor="gradeLevel" className="block text-sm font-normal text-neutral-700 dark:text-neutral-400 mb-1.5">
                Grade Level (e.g., 9, 10, 11, 12)
              </label>
              <Input
                id="gradeLevel"
                type="text" // Changed to text for flexibility, can be number if strict
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                className="w-full p-3 bg-transparent border border-neutral-300 dark:border-neutral-700 rounded-lg focus:ring-1 focus:ring-neutral-500 dark:focus:ring-neutral-500 dark:text-neutral-100 placeholder-neutral-500 dark:placeholder-neutral-500 dark:bg-neutral-800"
                // required // Grade level might be optional depending on requirements
                placeholder="e.g., 10"
                disabled={isLoading}
              />
            </div>
          )}
          
          <button
            type="submit"
            className="w-full mt-8 py-3 px-4 bg-neutral-800 text-neutral-100 font-semibold rounded-lg hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300 dark:focus:ring-offset-black dark:focus:ring-neutral-500 disabled:opacity-50 transition-colors duration-150"
            disabled={isLoading}
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