/**
 * Accessible Modal Component
 * 
 * Provides proper focus management, ARIA attributes, and keyboard navigation
 * for modal dialogs to ensure WCAG compliance.
 */

import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"
import { Button } from "./button"

interface AccessibleModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  className?: string
  /** 
   * Whether to show the close button in the header
   */
  showCloseButton?: boolean
  /**
   * Whether clicking the overlay should close the modal
   */
  closeOnOverlayClick?: boolean
  /**
   * Whether pressing Escape should close the modal
   */
  closeOnEscape?: boolean
  /**
   * Element to focus when modal opens (defaults to first focusable element)
   */
  initialFocusRef?: React.RefObject<HTMLElement>
  /**
   * Element to focus when modal closes (defaults to trigger element)
   */
  finalFocusRef?: React.RefObject<HTMLElement>
  /**
   * Size of the modal
   */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}

export const AccessibleModal: React.FC<AccessibleModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  initialFocusRef,
  finalFocusRef,
  size = 'md'
}) => {
  const modalRef = React.useRef<HTMLDivElement>(null)
  const titleId = React.useId()
  const descriptionId = React.useId()
  const [previouslyFocusedElement, setPreviouslyFocusedElement] = React.useState<HTMLElement | null>(null)

  // Size classes
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[95vw] max-h-[95vh]'
  }

  // Handle escape key
  React.useEffect(() => {
    if (!isOpen || !closeOnEscape) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, closeOnEscape, onClose])

  // Focus management
  React.useEffect(() => {
    if (!isOpen) return

    // Store the previously focused element
    setPreviouslyFocusedElement(document.activeElement as HTMLElement)

    // Focus the modal or specified element
    const focusModal = () => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus()
      } else if (modalRef.current) {
        // Focus first focusable element
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        const firstElement = focusableElements[0] as HTMLElement
        if (firstElement) {
          firstElement.focus()
        } else {
          modalRef.current.focus()
        }
      }
    }

    // Small delay to ensure modal is rendered
    const timer = setTimeout(focusModal, 100)

    return () => {
      clearTimeout(timer)
      // Return focus to previously focused element or specified element
      if (finalFocusRef?.current) {
        finalFocusRef.current.focus()
      } else if (previouslyFocusedElement) {
        previouslyFocusedElement.focus()
      }
    }
  }, [isOpen, initialFocusRef, finalFocusRef])

  // Focus trap
  React.useEffect(() => {
    if (!isOpen || !modalRef.current) return

    const modal = modalRef.current
    
    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return

      const focusableElements = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      const firstElement = focusableElements[0] as HTMLElement
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          event.preventDefault()
          lastElement?.focus()
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          event.preventDefault()
          firstElement?.focus()
        }
      }
    }

    modal.addEventListener('keydown', handleTabKey)
    return () => modal.removeEventListener('keydown', handleTabKey)
  }, [isOpen])

  // Prevent body scroll when modal is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleOverlayClick = (event: React.MouseEvent) => {
    if (closeOnOverlayClick && event.target === event.currentTarget) {
      onClose()
    }
  }

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={handleOverlayClick}
        aria-hidden="true"
      />
      
      {/* Modal */}
      <div
        ref={modalRef}
        className={cn(
          "relative bg-background border border-border rounded-lg shadow-lg w-full overflow-hidden",
          sizeClasses[size],
          size === 'full' && "h-full",
          className
        )}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="text-sm text-muted-foreground mt-1">
                {description}
              </p>
            )}
          </div>
          {showCloseButton && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close dialog"
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Content */}
        <div className={cn(
          "p-6 overflow-y-auto",
          size === 'full' && "flex-1"
        )}>
          {children}
        </div>
      </div>
    </div>
  )

  // Render in portal to ensure proper stacking
  return createPortal(modal, document.body)
}

/**
 * Accessible Modal Footer Component
 */
interface AccessibleModalFooterProps {
  children: React.ReactNode
  className?: string
}

export const AccessibleModalFooter: React.FC<AccessibleModalFooterProps> = ({
  children,
  className
}) => {
  return (
    <div className={cn(
      "flex items-center justify-end space-x-2 p-6 border-t border-border",
      className
    )}>
      {children}
    </div>
  )
}

/**
 * Hook for managing modal state with accessibility features
 */
export const useAccessibleModal = (initialState = false) => {
  const [isOpen, setIsOpen] = React.useState(initialState)
  const triggerRef = React.useRef<HTMLElement>(null)

  const open = React.useCallback(() => {
    // Store the element that opened the modal
    triggerRef.current = document.activeElement as HTMLElement
    setIsOpen(true)
  }, [])

  const close = React.useCallback(() => {
    setIsOpen(false)
  }, [])

  const toggle = React.useCallback(() => {
    if (isOpen) {
      close()
    } else {
      open()
    }
  }, [isOpen, open, close])

  return {
    isOpen,
    open,
    close,
    toggle,
    triggerRef
  }
} 