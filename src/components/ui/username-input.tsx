import React, { useState, useEffect, useCallback } from 'react'
import { EnhancedInput, ValidationRule } from './enhanced-input'
import { debounce } from 'lodash'

export interface UsernameInputProps {
  id?: string
  label?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  className?: string
  required?: boolean
  disabled?: boolean
  onValidationChange?: (isValid: boolean, errors: string[]) => void
  helperText?: string
}

// Username validation rules
const usernameValidationRules: ValidationRule[] = [
  {
    test: (value: string) => value.length >= 3,
    message: 'Username must be at least 3 characters long'
  },
  {
    test: (value: string) => value.length <= 20,
    message: 'Username must be no more than 20 characters long'
  },
  {
    test: (value: string) => /^[a-zA-Z0-9_-]+$/.test(value),
    message: 'Username can only contain letters, numbers, underscores, and hyphens'
  },
  {
    test: (value: string) => /^[a-zA-Z]/.test(value),
    message: 'Username must start with a letter'
  },
  {
    test: (value: string) => !/^.*[-_]{2,}.*$/.test(value),
    message: 'Username cannot contain consecutive special characters'
  }
]

export function UsernameInput({
  id,
  label = "Username",
  value,
  onChange,
  placeholder = "Choose a unique username",
  className = "",
  required = false,
  disabled = false,
  onValidationChange,
  helperText
}: UsernameInputProps) {
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false)
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)

  // Debounced function to check username availability
  const checkUsernameAvailability = useCallback(
    debounce(async (username: string) => {
      if (!username || username.length < 3) {
        setIsAvailable(null)
        setAvailabilityError(null)
        return
      }

      // Check if username passes basic validation first
      const hasValidationErrors = usernameValidationRules.some(rule => !rule.test(username))
      if (hasValidationErrors) {
        setIsAvailable(null)
        setAvailabilityError(null)
        return
      }

      setIsCheckingAvailability(true)
      setAvailabilityError(null)

      try {
        const response = await fetch('/api/auth/check-username', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username })
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to check username availability')
        }

        setIsAvailable(data.available)
        if (!data.available) {
          setAvailabilityError('Username is already taken')
        }
      } catch (error) {
        console.error('Username availability check failed:', error)
        setAvailabilityError('Unable to check username availability')
        setIsAvailable(null)
      } finally {
        setIsCheckingAvailability(false)
      }
    }, 500),
    []
  )

  // Check availability when username changes
  useEffect(() => {
    if (value) {
      checkUsernameAvailability(value)
    } else {
      setIsAvailable(null)
      setAvailabilityError(null)
      setIsCheckingAvailability(false)
    }

    // Cleanup function to cancel pending debounced calls
    return () => {
      checkUsernameAvailability.cancel()
    }
  }, [value, checkUsernameAvailability])

  // Enhanced validation that includes availability
  const handleValidationChange = useCallback((isValid: boolean, errors: string[]) => {
    let finalErrors = [...errors]
    let finalIsValid = isValid

    // Add availability error if exists
    if (availabilityError) {
      finalErrors.push(availabilityError)
      finalIsValid = false
    }

    // If still checking availability, not valid yet
    if (isCheckingAvailability) {
      finalIsValid = false
    }

    // If not available, not valid
    if (isAvailable === false) {
      finalIsValid = false
    }

    onValidationChange?.(finalIsValid, finalErrors)
  }, [availabilityError, isCheckingAvailability, isAvailable, onValidationChange])

  return (
    <EnhancedInput
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      required={required}
      disabled={disabled}
      type="text"
      validationRules={usernameValidationRules}
      onValidationChange={handleValidationChange}
      isValidating={isCheckingAvailability}
      validationSuccess={isAvailable === true}
      helperText={helperText || "3-20 characters, letters, numbers, underscore, and hyphen only"}
      showValidationIcon={true}
    />
  )
}