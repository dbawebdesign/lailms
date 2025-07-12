import React, { useState, useEffect } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from './button'
import { cn } from '@/lib/utils'

interface CopyButtonProps {
  text: string
  description?: string
  onCopy?: (text: string, description?: string) => Promise<boolean>
  className?: string
  size?: 'sm' | 'default' | 'lg'
  variant?: 'ghost' | 'outline' | 'default'
  showText?: boolean
}

export function CopyButton({
  text,
  description,
  onCopy,
  className = '',
  size = 'sm',
  variant = 'ghost',
  showText = false
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleCopy = async () => {
    if (isLoading) return
    
    setIsLoading(true)
    
    try {
      let success = false
      
      if (onCopy) {
        success = await onCopy(text, description)
      } else {
        // Default copy behavior
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text)
          success = true
        } else {
          // Fallback for older browsers
          const textArea = document.createElement('textarea')
          textArea.value = text
          textArea.style.position = 'absolute'
          textArea.style.left = '-999999px'
          document.body.appendChild(textArea)
          textArea.focus()
          textArea.select()
          success = document.execCommand('copy')
          document.body.removeChild(textArea)
        }
      }

      if (success) {
        setCopied(true)
        // Reset after 2 seconds
        setTimeout(() => setCopied(false), 2000)
      }
    } catch (error) {
      console.error('Copy failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const iconSize = size === 'lg' ? 'h-5 w-5' : size === 'default' ? 'h-4 w-4' : 'h-4 w-4'

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleCopy}
      disabled={isLoading}
      className={cn(
        'transition-all duration-200',
        copied && 'text-green-600 dark:text-green-400',
        isLoading && 'opacity-50 cursor-not-allowed',
        className
      )}
      title={copied ? 'Copied!' : `Copy ${description || 'text'}`}
    >
      <div className="flex items-center space-x-2">
        <div className={cn('transition-all duration-200', copied && 'scale-110')}>
          {copied ? (
            <Check className={cn(iconSize, 'text-green-600 dark:text-green-400')} />
          ) : (
            <Copy className={iconSize} />
          )}
        </div>
        {showText && (
          <span className="text-sm">
            {copied ? 'Copied!' : 'Copy'}
          </span>
        )}
      </div>
    </Button>
  )
}

// Specialized copy button for invite codes
export function InviteCodeCopyButton({
  code,
  description,
  onCopy,
  className = '',
  size = 'sm'
}: {
  code: string
  description?: string
  onCopy?: (code: string, description?: string) => Promise<boolean>
  className?: string
  size?: 'sm' | 'default' | 'lg'
}) {
  return (
    <CopyButton
      text={code}
      description={description || 'Invite code'}
      onCopy={onCopy}
      className={className}
      size={size}
      variant="ghost"
    />
  )
} 