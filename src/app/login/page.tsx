import LoginForm from '@/components/auth/LoginForm'
import Link from 'next/link'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <h1 className="text-3xl font-bold mb-8 text-center">Learnology.ai</h1>
      
      <LoginForm />
      
      <p className="mt-6 text-gray-600 dark:text-gray-400">
        Don't have an account? Contact your administrator for an invite code or{' '}
        <Link href="/signup" className="text-blue-600 hover:underline dark:text-blue-400">
          sign up here
        </Link>
        .
      </p>
    </div>
  )
} 