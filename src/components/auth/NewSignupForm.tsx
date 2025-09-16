'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { Loader2, Mail } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import EmailConfirmationSuccess from './EmailConfirmationSuccess'

export default function NewSignupForm() {
  const router = useRouter()
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false)

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!agreedToTerms) {
      toast.error('Please agree to the Terms of Service to continue')
      return
    }
    
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    setIsLoading(true)

    try {
      // Sign up with email and password
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (error) {
        throw error
      }

      if (data?.user) {
        // Check if email confirmation is required
        if (!data.user.email_confirmed_at) {
          // Email confirmation required - show success message
          setShowEmailConfirmation(true)
        } else {
          // Email already confirmed (shouldn't happen with confirmations enabled, but handle it)
          // Create initial profile
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              user_id: data.user.id,
              username: email.split('@')[0], // Default username from email
              role: 'teacher', // Default to teacher for homeschool users
              active_role: 'teacher' // Set active_role to teacher for homeschool users
            })

          if (profileError && profileError.code !== '23505') { // Ignore duplicate key errors
            console.error('Profile creation error:', profileError)
          }

          // Track referral signup with FirstPromoter
          try {
            await fetch('/api/firstpromoter/track-signup', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                email: email,
                uid: data.user.id 
              }),
            });
          } catch (fpError) {
            // Don't fail signup if FirstPromoter tracking fails
            console.warn('FirstPromoter tracking failed:', fpError);
          }

          // Redirect to homeschool signup flow
          router.push('/homeschool-signup')
        }
      }
    } catch (error: any) {
      console.error('Signup error:', error)
      toast.error(error.message || 'Failed to create account')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignup = async () => {
    if (!agreedToTerms) {
      toast.error('Please agree to the Terms of Service to continue')
      return
    }
    
    setIsLoading(true)

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
      console.error('Google signup error:', error)
      toast.error(error.message || 'Failed to sign up with Google')
      setIsLoading(false)
    }
  }

  // Show email confirmation success message if needed
  if (showEmailConfirmation) {
    return <EmailConfirmationSuccess email={email} />
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-neutral-900 dark:to-neutral-800">
      {/* Logo */}
      <div className="mb-8">
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

      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Create Your Account</CardTitle>
          <CardDescription className="text-center">
            Start your homeschool journey with Learnology AI
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Terms of Service Agreement */}
          <div className="flex items-center space-x-3 p-3 bg-neutral-900 dark:bg-neutral-800 rounded-lg border border-neutral-700 dark:border-neutral-600">
            <Checkbox
              id="terms"
              checked={agreedToTerms}
              onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
              className="mt-0.5"
            />
            {/* Use native label to avoid flex utilities from ui/label that cause word-by-word wrapping */}
            <label
              htmlFor="terms"
              className="text-sm text-neutral-300 dark:text-neutral-400 cursor-pointer leading-relaxed"
            >
              I agree to the <Link href="/terms-of-service" className="text-blue-400 hover:text-blue-300 underline">Terms of Service</Link> and understand that by creating an account, I am agreeing to this user agreement.
            </label>
          </div>

          {/* Google Sign Up */}
          <Button
            type="button"
            variant="outline"
            className="w-full border-neutral-300 dark:border-neutral-600 hover:border-neutral-400 dark:hover:border-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-all"
            onClick={handleGoogleSignup}
            disabled={isLoading || !agreedToTerms}
          >
            {isLoading ? (
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
            Continue with Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or continue with email</span>
            </div>
          </div>

          {/* Email Sign Up Form */}
          <form onSubmit={handleEmailSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">Must be at least 8 characters</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading || !agreedToTerms}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Sign Up with Email
                </>
              )}
            </Button>
          </form>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
