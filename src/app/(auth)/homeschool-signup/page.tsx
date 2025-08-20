import { Suspense } from 'react'
import { Metadata } from 'next'
import HomeschoolOnboarding from '@/components/auth/HomeschoolOnboarding'

export const metadata = {
  title: 'Setup Your Homeschool | Learnology AI',
  description: 'Create your personalized homeschool learning environment',
}

function LoadingState() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-neutral-50 to-white dark:from-neutral-950 dark:to-black">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 border-2 border-neutral-200 dark:border-neutral-800 border-t-neutral-900 dark:border-t-white rounded-full animate-spin mx-auto" />
        <p className="text-sm text-neutral-500 dark:text-neutral-400 font-light">Preparing your experience...</p>
      </div>
    </div>
  )
}

export default function HomeschoolSignupPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <HomeschoolOnboarding />
    </Suspense>
  )
} 