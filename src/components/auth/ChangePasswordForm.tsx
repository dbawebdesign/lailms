'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PasswordInput } from '@/components/ui/password-input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'

export default function ChangePasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isVerifying, setIsVerifying] = useState(true)
  const [isValidSession, setIsValidSession] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const verifySession = async () => {
      try {
        // Check if user has a valid session (they should after clicking the reset link)
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error || !session) {
          setError('Invalid or expired reset link. Please request a new password reset.')
          setIsValidSession(false)
        } else {
          setIsValidSession(true)
        }
      } catch (error) {
        console.error('Session verification error:', error)
        setError('Unable to verify reset session. Please try again.')
        setIsValidSession(false)
      } finally {
        setIsVerifying(false)
      }
    }

    verifySession()
  }, [supabase.auth])

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    // Validate passwords
    if (password.length < 6) {
      setError('Password must be at least 6 characters long')
      setIsLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setIsLoading(false)
      return
    }

    try {
      // Update the user's password
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) {
        throw error
      }

      // Success
      toast.success('Password updated successfully!')
      
      // Redirect to login page after a short delay
      setTimeout(() => {
        router.push('/login?message=password-updated')
      }, 2000)

    } catch (error: any) {
      console.error('Password update error:', error)
      setError(error.message || 'Failed to update password. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (isVerifying) {
    return (
      <div className="w-full max-w-md p-8 bg-white dark:bg-neutral-900 rounded-xl shadow-2xl dark:shadow-neutral-950/50">
        <div className="flex flex-col items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-neutral-600 dark:text-neutral-400 mb-4" />
          <p className="text-neutral-600 dark:text-neutral-400">Verifying reset link...</p>
        </div>
      </div>
    )
  }

  if (!isValidSession) {
    return (
      <div className="w-full max-w-md p-8 bg-white dark:bg-neutral-900 rounded-xl shadow-2xl dark:shadow-neutral-950/50">
        <div className="flex flex-col items-center justify-center py-8">
          <AlertCircle className="h-8 w-8 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
            Invalid Reset Link
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 text-center mb-6">
            {error || 'This password reset link is invalid or has expired.'}
          </p>
          <Button
            onClick={() => router.push('/reset-password')}
            className="w-full"
          >
            Request New Reset Link
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md p-8 bg-white dark:bg-neutral-900 rounded-xl shadow-2xl dark:shadow-neutral-950/50">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
          Set New Password
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Enter your new password below
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handlePasswordChange} className="space-y-5">
        <PasswordInput
          id="password"
          label="New Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-3 bg-transparent border border-neutral-300 dark:border-neutral-700 rounded-lg focus:ring-1 focus:ring-neutral-500 dark:focus:ring-neutral-500 dark:text-neutral-100 placeholder-neutral-500 dark:placeholder-neutral-500 dark:bg-neutral-800"
          required={true}
          disabled={isLoading}
          placeholder="Enter your new password"
        />

        <PasswordInput
          id="confirmPassword"
          label="Confirm New Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full p-3 bg-transparent border border-neutral-300 dark:border-neutral-700 rounded-lg focus:ring-1 focus:ring-neutral-500 dark:focus:ring-neutral-500 dark:text-neutral-100 placeholder-neutral-500 dark:placeholder-neutral-500 dark:bg-neutral-800"
          required={true}
          disabled={isLoading}
          placeholder="Confirm your new password"
        />

        <Button
          type="submit"
          disabled={isLoading || !password || !confirmPassword}
          className="w-full bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-neutral-200 text-white dark:text-neutral-900 font-medium py-3 px-4 rounded-lg transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Updating Password...
            </>
          ) : (
            'Update Password'
          )}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Password must be at least 6 characters long
        </p>
      </div>
    </div>
  )
}
