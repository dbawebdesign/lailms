import React, { useState, useCallback } from 'react'
import { Eye, EyeOff, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { Input } from './input'
import { Label } from './label'
import { cn } from '@/lib/utils'

export interface PasswordStrengthCriteria {
  minLength: boolean
  hasUppercase: boolean
  hasLowercase: boolean
  hasNumber: boolean
  hasSpecialChar: boolean
}

export interface EnhancedPasswordInputProps {
  id?: string
  label?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  className?: string
  required?: boolean
  disabled?: boolean
  showStrengthIndicator?: boolean
  minLength?: number
  confirmValue?: string // For password confirmation
  onValidationChange?: (isValid: boolean, errors: string[]) => void
  helperText?: string
}

const getPasswordStrength = (password: string, minLength: number = 8): PasswordStrengthCriteria => ({
  minLength: password.length >= minLength,
  hasUppercase: /[A-Z]/.test(password),
  hasLowercase: /[a-z]/.test(password),
  hasNumber: /\d/.test(password),
  hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
})

const calculatePasswordScore = (criteria: PasswordStrengthCriteria): number => {
  return Object.values(criteria).filter(Boolean).length
}

const getPasswordStrengthLabel = (score: number): { label: string; color: string } => {
  if (score === 0) return { label: '', color: '' }
  if (score <= 2) return { label: 'Weak', color: 'text-red-500' }
  if (score <= 3) return { label: 'Fair', color: 'text-yellow-500' }
  if (score <= 4) return { label: 'Good', color: 'text-blue-500' }
  return { label: 'Strong', color: 'text-green-500' }
}

export function EnhancedPasswordInput({
  id,
  label,
  value,
  onChange,
  placeholder = "Enter password",
  className = "",
  required = false,
  disabled = false,
  showStrengthIndicator = true,
  minLength = 8,
  confirmValue,
  onValidationChange,
  helperText
}: EnhancedPasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [touched, setTouched] = useState(false)
  const [isFocused, setIsFocused] = useState(false)

  const criteria = getPasswordStrength(value, minLength)
  const score = calculatePasswordScore(criteria)
  const strength = getPasswordStrengthLabel(score)
  
  // Validation logic (pure function - no side effects)
  const validatePassword = useCallback(() => {
    if (!touched && !value) return { isValid: !required, errors: [] }

    const errors: string[] = []
    
    // Check required field
    if (required && !value.trim()) {
      errors.push(`${label || 'Password'} is required`)
    }
    
    // Check minimum length
    if (value && !criteria.minLength) {
      errors.push(`Password must be at least ${minLength} characters`)
    }
    
    // Check password confirmation match
    if (confirmValue !== undefined && value !== confirmValue && (value || confirmValue)) {
      errors.push('Passwords do not match')
    }
    
    const isValid = errors.length === 0 && (value ? score >= 3 : !required)
    return { isValid, errors }
  }, [value, confirmValue, criteria.minLength, criteria.hasUppercase, criteria.hasLowercase, criteria.hasNumber, criteria.hasSpecialChar, score, required, label, minLength, touched])

  // Get current validation state
  const validationResult = validatePassword()
  const { isValid, errors: currentErrors } = validationResult

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!touched) setTouched(true)
    onChange(e)
    
    // Call validation callback after state update
    setTimeout(() => {
      const result = validatePassword()
      onValidationChange?.(result.isValid, result.errors)
    }, 0)
  }

  const handleBlur = () => {
    setTouched(true)
    setIsFocused(false)
    
    // Call validation callback after blur
    setTimeout(() => {
      const result = validatePassword()
      onValidationChange?.(result.isValid, result.errors)
    }, 0)
  }

  const handleFocus = () => {
    setIsFocused(true)
  }

  const hasErrors = currentErrors.length > 0 && touched

  return (
    <div className="space-y-2">
      {label && (
        <Label 
          htmlFor={id} 
          className={cn(
            "text-sm font-medium transition-colors",
            hasErrors ? "text-red-600 dark:text-red-400" : "text-neutral-700 dark:text-neutral-300"
          )}
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      
      <div className="relative">
        <Input
          id={id}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder={placeholder}
          className={cn(
            "pr-20 transition-all duration-200",
            hasErrors && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
            isValid && "border-green-500 focus:border-green-500 focus:ring-green-500/20",
            isFocused && !hasErrors && !isValid && "border-blue-500 focus:border-blue-500 focus:ring-blue-500/20",
            className
          )}
          required={required}
          disabled={disabled}
        />
        
        <div className="absolute inset-y-0 right-0 flex items-center">
          {/* Validation Icon */}
          <div className="pr-2">
            {isValid && (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )}
            {hasErrors && (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}
          </div>
          
          {/* Password Toggle Button */}
          <button
            type="button"
            onClick={togglePasswordVisibility}
            className="flex items-center pr-3 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors"
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
      
      {/* Password Strength Indicator */}
      {showStrengthIndicator && value && (
        <div className="space-y-2">
          {/* Strength Bar */}
          <div className="flex space-x-1">
            {[1, 2, 3, 4, 5].map((level) => (
              <div
                key={level}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors duration-200",
                  score >= level
                    ? score <= 2 
                      ? "bg-red-500"
                      : score <= 3
                      ? "bg-yellow-500"
                      : score <= 4
                      ? "bg-blue-500"
                      : "bg-green-500"
                    : "bg-neutral-200 dark:bg-neutral-700"
                )}
              />
            ))}
          </div>
          
          {/* Strength Label */}
          {strength.label && (
            <p className={cn("text-xs font-medium", strength.color)}>
              Password strength: {strength.label}
            </p>
          )}
          
          {/* Criteria Checklist */}
          {(isFocused || hasErrors) && (
            <div className="text-xs space-y-1">
              <div className={cn("flex items-center", criteria.minLength ? "text-green-600 dark:text-green-400" : "text-neutral-500 dark:text-neutral-400")}>
                <div className={cn("w-1 h-1 rounded-full mr-2", criteria.minLength ? "bg-green-500" : "bg-neutral-300")} />
                At least {minLength} characters
              </div>
              <div className={cn("flex items-center", criteria.hasUppercase ? "text-green-600 dark:text-green-400" : "text-neutral-500 dark:text-neutral-400")}>
                <div className={cn("w-1 h-1 rounded-full mr-2", criteria.hasUppercase ? "bg-green-500" : "bg-neutral-300")} />
                One uppercase letter
              </div>
              <div className={cn("flex items-center", criteria.hasLowercase ? "text-green-600 dark:text-green-400" : "text-neutral-500 dark:text-neutral-400")}>
                <div className={cn("w-1 h-1 rounded-full mr-2", criteria.hasLowercase ? "bg-green-500" : "bg-neutral-300")} />
                One lowercase letter
              </div>
              <div className={cn("flex items-center", criteria.hasNumber ? "text-green-600 dark:text-green-400" : "text-neutral-500 dark:text-neutral-400")}>
                <div className={cn("w-1 h-1 rounded-full mr-2", criteria.hasNumber ? "bg-green-500" : "bg-neutral-300")} />
                One number
              </div>
              <div className={cn("flex items-center", criteria.hasSpecialChar ? "text-green-600 dark:text-green-400" : "text-neutral-500 dark:text-neutral-400")}>
                <div className={cn("w-1 h-1 rounded-full mr-2", criteria.hasSpecialChar ? "bg-green-500" : "bg-neutral-300")} />
                One special character
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Helper Text */}
      {helperText && !hasErrors && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {helperText}
        </p>
      )}
    </div>
  )
}