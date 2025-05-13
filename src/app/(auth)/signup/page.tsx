import SignupForm from '@/components/auth/SignupForm'
import Link from 'next/link'
import Image from 'next/image'

export default function SignupPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-black text-white">
      {/* Logo */}
      <div className="mb-12">
        <Image 
          src="/Horizontal white text.png"
          alt="Learnology AI Logo"
          width={300}
          height={80}
          priority
        />
      </div>
      
      <SignupForm />
      
      <p className="mt-8 text-center text-sm text-gray-400">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-blue-500 hover:text-blue-400">
          Log in here
        </Link>
      </p>
    </div>
  )
} 