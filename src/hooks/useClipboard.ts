import { useState } from 'react'
import { toast } from '@/components/ui/use-toast'

interface UseClipboardOptions {
  successMessage?: string
  errorMessage?: string
  successDescription?: (text: string) => string
  errorDescription?: string
}

interface UseClipboardReturn {
  copy: (text: string, description?: string) => Promise<boolean>
  copied: boolean
  isLoading: boolean
}

export function useClipboard(options: UseClipboardOptions = {}): UseClipboardReturn {
  const [copied, setCopied] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const copy = async (text: string, description?: string): Promise<boolean> => {
    if (!text) {
      toast({
        title: "Copy failed",
        description: "No text to copy",
        variant: "destructive"
      })
      return false
    }

    setIsLoading(true)
    
    try {
      // Try using the modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
      } else {
        // Fallback for older browsers or non-secure contexts
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.style.position = 'absolute'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        
        const successful = document.execCommand('copy')
        document.body.removeChild(textArea)
        
        if (!successful) {
          throw new Error('Failed to copy using fallback method')
        }
      }

      setCopied(true)
      
      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000)

      // Show success toast
      const successDesc = options.successDescription 
        ? options.successDescription(description || 'Text')
        : `${description || 'Text'} copied to clipboard`

      toast({
        title: options.successMessage || "Copied!",
        description: successDesc,
      })

      return true
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      
      // Show error toast
      toast({
        title: options.errorMessage || "Copy failed",
        description: options.errorDescription || "Please select and copy the text manually",
        variant: "destructive"
      })

      return false
    } finally {
      setIsLoading(false)
    }
  }

  return { copy, copied, isLoading }
}

// Specialized hook for invite codes
export function useInviteCodeClipboard() {
  return useClipboard({
    successMessage: "Copied!",
    successDescription: (description) => `${description} copied to clipboard`,
    errorMessage: "Copy failed",
    errorDescription: "Please select and copy the code manually"
  })
}

// Specialized hook for enrollment codes
export function useEnrollmentCodeClipboard() {
  return useClipboard({
    successMessage: "Copied!",
    successDescription: (description) => `${description} copied to clipboard`,
    errorMessage: "Copy Failed",
    errorDescription: "Could not copy text to clipboard."
  })
} 