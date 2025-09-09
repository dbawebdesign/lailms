import Image from 'next/image'
import React from 'react'
import { Suspense } from 'react'
import { CanceledReactivateForm } from './reactivate-form'

export const metadata = {
  title: 'Account Canceled',
}

export default function CanceledPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6">
          <Image src="/web-app-manifest-192x192.png" alt="Learnology AI" width={72} height={72} />
        </div>
        <h1 className="text-2xl font-semibold mb-2">Your account has been canceled</h1>
        <p className="text-muted-foreground mb-6">
          Please click reactivate if you believe this is a mistake or if you want to reactivate your account.
        </p>
        <Suspense>
          <CanceledReactivateForm />
        </Suspense>
      </div>
    </div>
  )
}


