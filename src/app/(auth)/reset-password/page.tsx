import PasswordResetForm from '@/components/auth/PasswordResetForm'
import Link from 'next/link'
import Image from 'next/image'

export default function PasswordResetPage() {
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
      
      <PasswordResetForm />
      
      <p className="mt-8 text-center text-sm text-gray-400">
        Remember your password?{' '}
        <Link href="/login" className="font-medium text-blue-500 hover:text-blue-400">
          Log in here
        </Link>
      </p>
    </div>
  )
} 