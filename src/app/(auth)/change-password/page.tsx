import ChangePasswordForm from '@/components/auth/ChangePasswordForm'
import Link from 'next/link'
import { OptimizedLogo } from '@/components/ui/optimized-logo'
import { Suspense } from 'react'

export default function ChangePasswordPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-black text-white">
      <div className="mb-12">
        <OptimizedLogo 
          variant="horizontal-white"
          width={300}
          height={80}
          priority={true}
        />
      </div>
      
      <Suspense fallback={
        <div className="w-full max-w-md p-8 bg-white dark:bg-neutral-900 rounded-xl shadow-2xl dark:shadow-neutral-950/50 animate-pulse h-96"></div>
      }>
        <ChangePasswordForm />
      </Suspense>
      
      <p className="mt-8 text-center text-sm text-gray-400">
        Remember your password?{' '}
        <Link href="/login" className="font-medium text-blue-500 hover:text-blue-400">
          Log in here
        </Link>
      </p>
    </div>
  )
}
