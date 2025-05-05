'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function PasswordResetForm() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  
  // Step 1: Enter username
  const [username, setUsername] = useState('')
  
  // Step 2: Enter reset code and new password
  const [resetCode, setResetCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  const [successMessage, setSuccessMessage] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Step 1: Request password reset code
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/request-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to request password reset')
      }

      // Move to next step
      setSuccessMessage('A reset code has been sent to your administrator. Please contact them to receive your code.')
      setStep(2)
    } catch (error: any) {
      setError(error.message || 'An error occurred while requesting your password reset')
    } finally {
      setIsLoading(false)
    }
  }

  // Step 2: Submit reset code and new password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          resetCode,
          newPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password')
      }

      // Show success message and redirect to login
      setSuccessMessage('Password reset successful')
      setTimeout(() => {
        router.push('/login?reset=success')
      }, 2000)
    } catch (error: any) {
      setError(error.message || 'An error occurred while resetting your password')
    } finally {
      setIsLoading(false)
    }
  }

  // Render Step 1: Username form
  if (step === 1) {
    return (
      <div className="w-full max-w-md p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-6 text-center">Reset Password</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4 text-center">
          Enter your username to request a password reset code.
        </p>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200 rounded">
            {error}
          </div>
        )}
        
        <form onSubmit={handleRequestReset} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium mb-1">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
              required
              disabled={isLoading}
            />
          </div>
          
          <button
            type="submit"
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : 'Request Reset Code'}
          </button>
          
          <div className="text-center mt-4">
            <Link
              href="/login"
              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              Back to Login
            </Link>
          </div>
        </form>
      </div>
    )
  }

  // Render Step 2: Reset code and new password form
  return (
    <div className="w-full max-w-md p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4 text-center">Reset Password</h2>
      
      {successMessage && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200 rounded">
          {successMessage}
        </div>
      )}
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200 rounded">
          {error}
        </div>
      )}
      
      <form onSubmit={handleResetPassword} className="space-y-4">
        <div>
          <label htmlFor="resetCode" className="block text-sm font-medium mb-1">
            Reset Code
          </label>
          <input
            id="resetCode"
            type="text"
            value={resetCode}
            onChange={(e) => setResetCode(e.target.value)}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
            required
            disabled={isLoading}
          />
        </div>
        
        <div>
          <label htmlFor="newPassword" className="block text-sm font-medium mb-1">
            New Password
          </label>
          <input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
            required
            minLength={8}
            disabled={isLoading}
          />
        </div>
        
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">
            Confirm New Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
            required
            disabled={isLoading}
          />
        </div>
        
        <div className="flex items-center justify-between gap-4 mt-6">
          <button
            type="button"
            className="py-2 px-4 border border-gray-300 rounded hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onClick={() => setStep(1)}
            disabled={isLoading}
          >
            Back
          </button>
          
          <button
            type="submit"
            className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? 'Resetting...' : 'Reset Password'}
          </button>
        </div>
      </form>
    </div>
  )
} 