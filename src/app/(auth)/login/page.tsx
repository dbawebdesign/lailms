import LoginForm from '@/components/auth/LoginForm'
import Link from 'next/link'
import Image from 'next/image'

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
      
      <LoginForm />
      
      <p className="mt-8 text-center text-sm text-gray-400">
        Don't have an account? Contact your administrator for an invite code or{' '}
        <Link href="/signup" className="font-medium text-blue-500 hover:text-blue-400">
          sign up here
        </Link>
        .
      </p>
    </div>
  )
} 