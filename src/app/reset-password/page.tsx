import PasswordResetForm from '@/components/auth/PasswordResetForm'
import Link from 'next/link'

export default function PasswordResetPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <h1 className="text-3xl font-bold mb-8 text-center">Learnology.ai</h1>
      
      <PasswordResetForm />
      
      <p className="mt-6 text-gray-600 dark:text-gray-400">
        Remember your password?{' '}
        <Link href="/login" className="text-blue-600 hover:underline dark:text-blue-400">
          Log in here
        </Link>
      </p>
    </div>
  )
} 