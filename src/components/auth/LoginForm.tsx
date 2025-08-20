'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { PasswordInput } from '@/components/ui/password-input'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'


export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const justRegistered = searchParams.get('registered') === 'true'
  
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Invalid username or password')
      }

      // Redirect based on effective role and organization type
      const userRole = data.role?.toUpperCase(); // Ensure role is uppercase for consistent matching
      const orgType = data.organisation_type; // Get organization type from login response
      let redirectPath = '/dashboard'; // Default redirect

      switch (userRole) {
        case 'STUDENT':
          redirectPath = '/learn';
          break;
        case 'TEACHER':
          // Check if this is a homeschool teacher
          if (orgType === 'individual_family' || orgType === 'homeschool_coop') {
            redirectPath = '/homeschool';
          } else {
            redirectPath = '/teach';
          }
          break;
        case 'ADMIN':
          redirectPath = '/school';
          break;
        case 'SUPER_ADMIN': // Ensure this matches the enum value in your DB
          redirectPath = '/org';
          break;
        default:
          // If role is not recognized or missing, redirect to a generic dashboard or error page
          console.warn(`Unrecognized or missing user role: ${data.role}, redirecting to /dashboard`);
          redirectPath = '/dashboard'; 
      }

      // Add a small delay to ensure session is fully established before redirecting
      setTimeout(() => {
        router.push(redirectPath);
      }, 100);
    } catch (error: any) {
      setError(error.message || 'Failed to log in')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true)
    setError('')

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      })

      if (error) {
        throw error
      }
    } catch (error: any) {
      console.error('Google login error:', error)
      setError(error.message || 'Failed to sign in with Google')
      setIsGoogleLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md p-8 bg-white dark:bg-neutral-900 rounded-xl shadow-2xl dark:shadow-neutral-950/50">

      <h2 className="text-3xl font-semibold mb-6 text-center text-neutral-800 dark:text-neutral-100">Log In</h2>
      
      {justRegistered && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 dark:bg-green-800/30 dark:text-green-300 rounded-md">
          Account created successfully! Please log in with your new credentials.
        </div>
      )}
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 dark:bg-red-800/30 dark:text-red-300 rounded-md">
          {error}
        </div>
      )}

      {/* Google Sign In */}
      <Button
        type="button"
        variant="outline"
        className="w-full mb-4 border-neutral-300 dark:border-neutral-600 hover:border-neutral-400 dark:hover:border-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-all"
        onClick={handleGoogleLogin}
        disabled={isGoogleLoading || isLoading}
      >
        {isGoogleLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
        )}
        Sign in with Google
      </Button>

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <Separator className="w-full" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white dark:bg-neutral-900 px-2 text-neutral-500 dark:text-neutral-400">Or continue with username</span>
        </div>
      </div>
      
      <form onSubmit={handleLogin} className="space-y-5">
        <div>
          <label htmlFor="username" className="block text-sm font-normal text-neutral-700 dark:text-neutral-400 mb-1.5">
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-3 bg-transparent border border-neutral-300 dark:border-neutral-700 rounded-lg focus:ring-1 focus:ring-neutral-500 dark:focus:ring-neutral-500 dark:text-neutral-100 placeholder-neutral-500 dark:placeholder-neutral-500 dark:bg-neutral-800"
            required
            disabled={isLoading}
            placeholder="Enter your username"
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
          placeholder="Enter your password"
        />
        
        <div className="flex justify-end mt-1">
          <Link
            href="/reset-password"
            className="text-sm text-neutral-600 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors duration-150"
          >
            Forgot password?
          </Link>
        </div>
        
        <button
          type="submit"
          className="w-full mt-6 py-3 px-4 bg-neutral-800 text-neutral-100 font-semibold rounded-lg hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300 dark:focus:ring-offset-black dark:focus:ring-neutral-500 disabled:opacity-50 transition-colors duration-150"
          disabled={isLoading}
        >
          {isLoading ? 'Logging in...' : 'Log In'}
        </button>
      </form>
    </div>
  )
} 