"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export function CanceledReactivateForm() {
  const [showInput, setShowInput] = useState(false)
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle'|'sending'|'sent'|'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) {
      setError('Please enter a brief message.')
      return
    }
    setError(null)
    setStatus('sending')
    try {
      const res = await fetch('/api/account/reactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      if (!res.ok) throw new Error('Request failed')
      setStatus('sent')
    } catch (err) {
      setStatus('error')
      setError('Something went wrong. Please try again.')
    }
  }

  if (status === 'sent') {
    return (
      <div className="rounded-lg border p-4 text-left">
        <p>
          Our team has been notified and will be in contact with you shortly.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {!showInput ? (
        <Button onClick={() => setShowInput(true)} className="w-full">
          Reactivate
        </Button>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3 text-left">
          <label htmlFor="message" className="text-sm font-medium">Tell us briefly why you want to reactivate</label>
          <Textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="It was a mistake / I'd like to resume my account..."
            className="min-h-24"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className={cn('w-full')} disabled={status === 'sending'}>
            {status === 'sending' ? 'Sending...' : 'Submit' }
          </Button>
        </form>
      )}
    </div>
  )
}


