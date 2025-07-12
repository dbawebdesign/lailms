'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { PasswordInput } from '@/components/ui/password-input'

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const justRegistered = searchParams.get('registered') === 'true'
  
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

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

      // Redirect based on effective role (API returns active_role || role to handle role switching)
      const userRole = data.role?.toUpperCase(); // Ensure role is uppercase for consistent matching
      let redirectPath = '/dashboard'; // Default redirect

      switch (userRole) {
        case 'STUDENT':
          redirectPath = '/learn';
          break;
        case 'TEACHER':
          redirectPath = '/teach';
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