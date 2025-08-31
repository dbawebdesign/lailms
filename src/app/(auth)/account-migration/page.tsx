'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import AccountMigration from '@/components/auth/AccountMigration'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'

function AccountMigrationContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [migrationData, setMigrationData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')
    
    if (!token) {
      setError('Invalid migration request')
      setIsLoading(false)
      return
    }

    // Get migration data from cookie/token
    const migrationCookie = document.cookie
      .split('; ')
      .find(row => row.startsWith('migration_token='))
    
    const cookieToken = migrationCookie?.split('=')[1]
    
    if (cookieToken !== token) {
      setError('Invalid or expired migration session')
      setIsLoading(false)
      return
    }

    // Validate token and get profile data
    fetch('/api/auth/validate-migration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setMigrationData(data)
        }
      })
      .catch(err => {
        console.error('Migration validation error:', err)
        setError('Failed to validate migration session')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [searchParams, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Preparing your account migration...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Alert className="max-w-md">
          <AlertDescription>
            {error}. Please try logging in again or contact support if the issue persists.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!migrationData) {
    return null
  }

  return (
    <AccountMigration
      migrationToken={searchParams.get('token') || ''}
      profile={migrationData.profile}
    />
  )
}

export default function AccountMigrationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }>
      <AccountMigrationContent />
    </Suspense>
  )
}
