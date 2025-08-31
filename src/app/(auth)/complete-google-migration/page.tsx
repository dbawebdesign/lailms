'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle2 } from 'lucide-react'

export default function CompleteGoogleMigrationPage() {
  const router = useRouter()
  const supabase = createClient()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [error, setError] = useState('')

  useEffect(() => {
    completeMigration()
  }, [])

  const completeMigration = async () => {
    try {
      // Get migration token from URL
      const urlParams = new URLSearchParams(window.location.search)
      let migrationToken = urlParams.get('migration_token')
      
      if (!migrationToken) {
        // Fallback to session storage
        const migrationDataStr = sessionStorage.getItem('migration_data')
        if (!migrationDataStr) {
          throw new Error('Migration token not found')
        }
        const migrationData = JSON.parse(migrationDataStr)
        migrationToken = migrationData.migrationToken
      }

      // Get additional migration data from session storage if available
      const migrationDataStr = sessionStorage.getItem('migration_data')
      const migrationData = migrationDataStr ? JSON.parse(migrationDataStr) : {}
      const { familyName, students } = migrationData

      // Get the current user (they just signed in with Google)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('No authenticated user found')
      }

      // Complete the migration with the Google account email
      const response = await fetch('/api/auth/complete-migration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          useGoogle: true,
          migrationToken,
          familyName,
          students
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Migration failed')
      }

      // Clear migration data
      sessionStorage.removeItem('migration_data')

      setStatus('success')

      // Redirect to appropriate dashboard
      setTimeout(() => {
        router.push(data.redirectTo || '/dashboard')
      }, 2000)
    } catch (error: any) {
      console.error('Migration completion error:', error)
      setError(error.message || 'Failed to complete migration')
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-neutral-900 dark:to-neutral-800">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            {status === 'processing' && 'Completing Your Account Migration'}
            {status === 'success' && 'Migration Successful!'}
            {status === 'error' && 'Migration Failed'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'processing' && (
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600" />
              <p className="text-muted-foreground">
                Linking your Google account and migrating your data...
              </p>
              <p className="text-sm text-muted-foreground">
                This may take a few moments. Please do not close this window.
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center space-y-4">
              <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto" />
              <p className="text-lg font-medium">
                Your account has been successfully migrated!
              </p>
              <p className="text-muted-foreground">
                You can now sign in with your Google account. Redirecting to your dashboard...
              </p>
              <div className="flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            </div>
          )}

          {status === 'error' && (
            <>
              <Alert variant="destructive">
                <AlertDescription>
                  {error}
                </AlertDescription>
              </Alert>
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Please try logging in again or contact support if the issue persists.
                </p>
                <button
                  onClick={() => router.push('/login')}
                  className="text-blue-600 hover:underline"
                >
                  Return to Login
                </button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
