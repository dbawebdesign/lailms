'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DevAdminPage() {
  const router = useRouter()
  
  useEffect(() => {
    // Redirect to organizations page
    router.push('/dev-admin/organisations')
  }, [router])
  
  return (
    <div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
      <p>Redirecting to Organisations...</p>
    </div>
  )
} 