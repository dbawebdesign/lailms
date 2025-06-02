import LoginForm from '@/components/auth/LoginForm'
import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-black text-white">
      <div className="mb-12">
        <Image 
          src="/Horizontal white text.png"
          alt="Learnology AI Logo"
          width={300}
          height={80}
          priority
        />
      </div>
      
      <Suspense fallback={<div className="w-full max-w-md p-8 bg-white dark:bg-neutral-900 rounded-xl shadow-2xl dark:shadow-neutral-950/50 animate-pulse h-96"></div>}>
        <LoginForm />
      </Suspense>
      
      <p className="mt-10 text-center text-sm text-gray-500 dark:text-neutral-400">
        Don't have an account? Contact your administrator for an invite code or{' '}
        <Link href="/signup" className="font-medium text-neutral-600 hover:text-neutral-800 dark:text-neutral-300 dark:hover:text-neutral-100 transition-colors duration-150">
          sign up here
        </Link>
        .
      </p>
    </div>
  )
} 