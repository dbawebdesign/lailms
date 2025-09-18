'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Loader2, Mail } from 'lucide-react'

export default function PasswordResetForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [error, setError] = useState('')

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/reset-password-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send reset email')
      }

      setEmailSent(true)
      toast.success('Password reset email sent!')
    } catch (error: any) {
      setError(error.message || 'An error occurred while sending the reset email')
    } finally {
      setIsLoading(false)
    }
  }

  if (emailSent) {
    return (
      <div className="w-full max-w-md p-8 bg-white dark:bg-neutral-900 rounded-xl shadow-2xl dark:shadow-neutral-950/50">
        <div className="flex flex-col items-center justify-center py-8">
          <Mail className="h-12 w-12 text-green-500 mb-4" />
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
            Check Your Email
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 text-center mb-6">
            We've sent a password reset link to your email address. Click the link in the email to reset your password.
          </p>
          <div className="w-full space-y-3">
            <Button
              onClick={() => setEmailSent(false)}
              variant="outline"
              className="w-full"
            >
              Send Another Email
            </Button>
            <Button
              onClick={() => router.push('/login')}
              className="w-full"
            >
              Back to Login
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md p-8 bg-white dark:bg-neutral-900 rounded-xl shadow-2xl dark:shadow-neutral-950/50">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
          Reset Password
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Enter your username or email to receive a password reset link
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleRequestReset} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-normal text-neutral-700 dark:text-neutral-400 mb-1.5">
            Username or Email
          </label>
          <input
            id="email"
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 bg-transparent border border-neutral-300 dark:border-neutral-700 rounded-lg focus:ring-1 focus:ring-neutral-500 dark:focus:ring-neutral-500 dark:text-neutral-100 placeholder-neutral-500 dark:placeholder-neutral-500 dark:bg-neutral-800"
            required
            disabled={isLoading}
            placeholder="Enter your username or email"
          />
        </div>

        <Button
          type="submit"
          disabled={isLoading || !email}
          className="w-full bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-neutral-200 text-white dark:text-neutral-900 font-medium py-3 px-4 rounded-lg transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending Reset Link...
            </>
          ) : (
            'Send Reset Link'
          )}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Remember your password?{' '}
          <Link href="/login" className="text-neutral-600 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors duration-150">
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  )
}