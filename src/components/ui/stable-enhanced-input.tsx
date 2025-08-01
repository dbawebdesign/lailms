import React, { useState, useMemo } from 'react'
import { Input } from './input'
import { Label } from './label'
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ValidationRule {
  test: (value: string) => boolean
  message: string
}

export interface StableEnhancedInputProps {
  id?: string
  label?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  className?: string
  required?: boolean
  disabled?: boolean
  type?: string
  validationRules?: ValidationRule[]
  onValidationChange?: (isValid: boolean, errors: string[]) => void
  isValidating?: boolean
  validationSuccess?: boolean
  helperText?: string
  showValidationIcon?: boolean
}

export function StableEnhancedInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  className = "",
  required = false,
  disabled = false,
  type = "text",
  validationRules = [],
  onValidationChange,
  isValidating = false,
  validationSuccess = false,
  helperText,
  showValidationIcon = true,
  ...props
}: StableEnhancedInputProps) {
  const [touched, setTouched] = useState(false)
  const [isFocused, setIsFocused] = useState(false)

  // Validate input value using useMemo to avoid unnecessary recalculations
  const validationResult = useMemo(() => {
    if (!touched && !value) {
      return { errors: [], isValid: !required }
    }

    const validationErrors: string[] = []
    
    // Check required field
    if (required && !value.trim()) {
      validationErrors.push(`${label || 'This field'} is required`)
    }
    
    // Run custom validation rules
    if (value && validationRules && validationRules.length > 0) {
      validationRules.forEach(rule => {
        if (!rule.test(value)) {
          validationErrors.push(rule.message)
        }
      })
    }

    const isValid = validationErrors.length === 0 && !isValidating
    
    // Call validation change callback
    if (onValidationChange && touched) {
      // Use setTimeout to avoid calling setState during render
      setTimeout(() => {
        onValidationChange(isValid, validationErrors)
      }, 0)
    }

    return { errors: validationErrors, isValid }
  }, [value, required, label, touched, isValidating, validationRules])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!touched) setTouched(true)
    onChange(e)
  }

  const handleBlur = () => {
    setTouched(true)
    setIsFocused(false)
  }

  const handleFocus = () => {
    setIsFocused(true)
  }

  const hasErrors = validationResult.errors.length > 0 && touched
  const isValid = !hasErrors && !isValidating && touched && value
  const showSuccess = isValid && (validationSuccess || showValidationIcon)

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
          type={type}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder={placeholder}
          className={cn(
            "transition-all duration-200",
            showValidationIcon && "pr-10",
            hasErrors && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
            showSuccess && "border-green-500 focus:border-green-500 focus:ring-green-500/20",
            isFocused && !hasErrors && !showSuccess && "border-blue-500 focus:border-blue-500 focus:ring-blue-500/20",
            className
          )}
          required={required}
          disabled={disabled}
          {...props}
        />
        
        {showValidationIcon && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            {isValidating && (
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            )}
            {!isValidating && hasErrors && (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}
            {!isValidating && showSuccess && (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )}
          </div>
        )}
      </div>
      
      {/* Error Messages */}
      {hasErrors && (
        <div className="space-y-1">
          {validationResult.errors.map((error, index) => (
            <p key={index} className="text-sm text-red-600 dark:text-red-400 flex items-center">
              <AlertCircle className="h-3 w-3 mr-1 flex-shrink-0" />
              {error}
            </p>
          ))}
        </div>
      )}
      
      {/* Helper Text */}
      {helperText && !hasErrors && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {helperText}
        </p>
      )}
      
      {/* Success Message */}
      {showSuccess && !helperText && (
        <p className="text-sm text-green-600 dark:text-green-400 flex items-center">
          <CheckCircle className="h-3 w-3 mr-1" />
          Looks good!
        </p>
      )}
    </div>
  )
}