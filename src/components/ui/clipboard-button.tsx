'use client'

import React from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useClipboard } from '@/hooks/useClipboard'
import { cn } from '@/lib/utils'

interface ClipboardButtonProps extends Omit<React.ComponentProps<typeof Button>, 'onClick'> {
  text: string
  description?: string
  showText?: boolean
  iconOnly?: boolean
}

export function ClipboardButton({ 
  text, 
  description, 
  showText = false, 
  iconOnly = true,
  className,
  variant = "ghost",
  size = "sm",
  ...props 
}: ClipboardButtonProps) {
  const { copy, copied, isLoading } = useClipboard()

  const handleCopy = () => {
    copy(text, description)
  }

  if (iconOnly) {
    return (
      <Button
        variant={variant}
        size={size}
        onClick={handleCopy}
        disabled={isLoading}
        className={cn("h-8 w-8 p-0", className)}
        {...props}
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-600" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
        <span className="sr-only">
          Copy {description || 'text'} to clipboard
        </span>
      </Button>
    )
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleCopy}
      disabled={isLoading}
      className={cn("flex items-center gap-2", className)}
      {...props}
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
      {showText && (
        <span>{copied ? 'Copied!' : `Copy${description ? ` ${description}` : ''}`}</span>
      )}
    </Button>
  )
}

// Specialized components for different use cases
export function InviteCodeButton({ code, ...props }: { code: string } & Omit<ClipboardButtonProps, 'text' | 'description'>) {
  return (
    <ClipboardButton
      text={code}
      description="Invite code"
      {...props}
    />
  )
}

export function EnrollmentCodeButton({ code, ...props }: { code: string } & Omit<ClipboardButtonProps, 'text' | 'description'>) {
  return (
    <ClipboardButton
      text={code}
      description="Enrollment code"
      {...props}
    />
  )
} 