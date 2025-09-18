'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, CheckCircle, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface EmailConfirmationSuccessProps {
  email: string
  onResendEmail?: () => void
}

export default function EmailConfirmationSuccess({ email, onResendEmail }: EmailConfirmationSuccessProps) {
  const [isResending, setIsResending] = useState(false)
  const supabase = createClient()

  const handleResendEmail = async () => {
    setIsResending(true)
    
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (error) {
        throw error
      }

      toast.success('Confirmation email sent! Please check your inbox.')
    } catch (error: any) {
      console.error('Resend email error:', error)
      toast.error('Failed to resend email. Please try again.')
    } finally {
      setIsResending(false)
    }
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
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl font-bold">Check Your Email</CardTitle>
          <CardDescription>
            We've sent a confirmation link to your email address
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Email Display */}
          <div className="flex items-center justify-center space-x-2 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg border">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{email}</span>
          </div>

          {/* Instructions */}
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start space-x-2">
              <span className="flex-shrink-0 w-5 h-5 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-bold">1</span>
              <p>Click the confirmation link in your email to verify your account</p>
            </div>
            <div className="flex items-start space-x-2">
              <span className="flex-shrink-0 w-5 h-5 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-bold">2</span>
              <p>Check your spam folder if you don't see the email within a few minutes</p>
            </div>
            <div className="flex items-start space-x-2">
              <span className="flex-shrink-0 w-5 h-5 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-bold">3</span>
              <p>Once confirmed, you'll be automatically redirected to complete your account setup</p>
            </div>
          </div>

          {/* Resend Email Button */}
          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleResendEmail}
              disabled={isResending}
            >
              {isResending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Resend Confirmation Email
                </>
              )}
            </Button>
          </div>

          {/* Help Text */}
          <div className="text-center text-sm text-muted-foreground">
            <p>Still having trouble? <Link href="/contact" className="text-primary hover:underline">Contact support</Link></p>
          </div>

          {/* Back to Login */}
          <div className="text-center text-sm">
            <Link href="/login" className="text-primary hover:underline">
              Back to Sign In
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
