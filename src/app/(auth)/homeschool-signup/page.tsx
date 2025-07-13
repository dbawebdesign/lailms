import { Suspense } from 'react'
import { Metadata } from 'next'
import HomeschoolSignupForm from '@/components/auth/HomeschoolSignupForm'
import { Loader2 } from 'lucide-react'

export const metadata = {
  title: 'Homeschool Signup | Learnology AI',
  description: 'Create your homeschool organization account with Learnology AI',
}

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto" />
        <p className="text-neutral-600 dark:text-neutral-400">Loading signup form...</p>
      </div>
    </div>
  )
}

export default function HomeschoolSignupPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <HomeschoolSignupForm />
    </Suspense>
  )
} 