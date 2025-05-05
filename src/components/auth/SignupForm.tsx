'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
// import { Button } from '@learnologyai/ui' // Temporarily comment out
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

interface InviteCodeData {
  valid: boolean
  role: string
  organisation: {
    id: string
    name: string
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
      const response = await fetch('/api/invite-code/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inviteCode }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify invite code')
      }

      setInviteCodeData(data)
      setStep(2) // Move to next step
    } catch (error) {
      setIsLoading(false)
      // Assert error type
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
      toast.error(`Invite code verification failed: ${errorMessage}`)
    }
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
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteCode,
          username,
          password,
          firstName,
          lastName,
          gradeLevel,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create account')
      }

      // Redirect to login page on success
      router.push('/login?registered=true')
    } catch (error) {
      setIsLoading(false)
      // Assert error type
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
      toast.error(`Signup failed: ${errorMessage}`)
    }
  }

  // Render Step 1: Invite Code Verification
  if (step === 1) {
    return (
      <div className="w-full max-w-md p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-6 text-center">Create Account</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4 text-center">
          Enter your invite code to get started
        </p>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200 rounded">
            {error}
          </div>
        )}
        
        <form onSubmit={handleVerifyCode}>
          <div className="mb-4">
            <label htmlFor="inviteCode" className="block text-sm font-medium mb-1">
              Invite Code
            </label>
            <Input
              id="inviteCode"
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
              required
              placeholder="Enter your invite code"
              disabled={isLoading}
            />
          </div>
          
          <button
            type="submit"
            className="w-full mt-4"
            disabled={isLoading}
          >
            {isLoading ? 'Verifying...' : 'Continue'}
          </button>
        </form>
      </div>
    )
  }

  // Render Step 2: Account Creation
  return (
    <div className="w-full max-w-md p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-2 text-center">Create Your Account</h2>
      
      {inviteCodeData && (
        <p className="text-green-600 dark:text-green-400 mb-4 text-center">
          Welcome to {inviteCodeData.organisation.name}! You're signing up as a {inviteCodeData.role}.
        </p>
      )}
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200 rounded">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSignup} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium mb-1">
              First Name
            </label>
            <Input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
              required
              disabled={isLoading}
            />
          </div>
          
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium mb-1">
              Last Name
            </label>
            <Input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
              required
              disabled={isLoading}
            />
          </div>
        </div>
        
        <div>
          <label htmlFor="username" className="block text-sm font-medium mb-1">
            Username
          </label>
          <Input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
            required
            disabled={isLoading}
          />
        </div>
        
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1">
            Password
          </label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
            required
            disabled={isLoading}
            minLength={8}
          />
        </div>
        
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">
            Confirm Password
          </label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
            required
            disabled={isLoading}
          />
        </div>
        
        {inviteCodeData?.role === 'student' && (
          <div>
            <label htmlFor="gradeLevel" className="block text-sm font-medium mb-1">
              Grade Level
            </label>
            <select
              id="gradeLevel"
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
              disabled={isLoading}
            >
              <option value="">Select Grade Level</option>
              {[...Array(12)].map((_, i) => (
                <option key={i + 1} value={String(i + 1)}>
                  Grade {i + 1}
                </option>
              ))}
            </select>
          </div>
        )}
        
        <div className="flex items-center justify-between gap-4 mt-6">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
          >
            Back
          </button>
          
          <button
            type="submit"
            className="flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            disabled={isLoading}
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>
        </div>
      </form>
    </div>
  )
} 