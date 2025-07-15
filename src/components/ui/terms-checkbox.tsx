'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import Link from 'next/link'

interface TermsCheckboxProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  error?: string
  disabled?: boolean
  id?: string
}

export function TermsCheckbox({ 
  checked, 
  onCheckedChange, 
  error, 
  disabled = false,
  id = 'terms-agreement'
}: TermsCheckboxProps) {
  return (
    <div className="space-y-3 w-full">
      <div className="flex items-start space-x-3 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 w-full">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          className={`mt-1 flex-shrink-0 ${error ? 'border-red-500' : ''}`}
        />
        <div className="flex-1 min-w-0">
          <Label 
            htmlFor={id} 
            className="text-sm leading-relaxed cursor-pointer text-neutral-700 dark:text-neutral-300 block"
          >
            I agree to the{' '}
            <Link 
              href="/terms-of-service" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline underline-offset-2 font-medium transition-colors"
            >
              Terms of Service
            </Link>
            {' '}and understand that by creating an account, I am agreeing to this user agreement.
          </Label>
        </div>
      </div>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 ml-2">
          {error}
        </p>
      )}
    </div>
  )
}

export default TermsCheckbox