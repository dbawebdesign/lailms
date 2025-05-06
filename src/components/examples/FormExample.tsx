"use client";

import { useState } from 'react';
import { useFormContext } from '@/hooks/useFormContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * Example form component that demonstrates form context tracking
 * This component registers with Luna to provide form state awareness
 */
export function FormExample() {
  // Form state
  const [formState, setFormState] = useState({
    firstName: '',
    lastName: '',
    email: '',
    gradeLevel: '',
    agreedToTerms: false,
    interests: [] as string[],
  });
  
  // Form validation state
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Register with Luna context system using our form hook
  const { 
    trackSubmit,
    trackFieldFocus,
    trackFieldBlur,
    trackFieldChange,
    trackValidationError
  } = useFormContext(formState, {
    formId: 'student-registration-form',
    role: 'registration-form',
    metadata: {
      formType: 'registration',
      formVersion: '1.0',
      userType: 'student'
    }
  });
  
  // Handle field changes
  const handleChange = (field: string, value: string | boolean | string[]) => {
    setFormState(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for this field if it exists
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
    
    // Track field change in Luna context
    trackFieldChange(field);
  };
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Track submission attempt in Luna context
    trackSubmit();
    
    // Validate form
    const newErrors: Record<string, string> = {};
    
    if (!formState.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    
    if (!formState.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    
    if (!formState.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!formState.gradeLevel) {
      newErrors.gradeLevel = 'Please select a grade level';
    }
    
    if (!formState.agreedToTerms) {
      newErrors.agreedToTerms = 'You must agree to the terms';
    }
    
    // If we have errors, update error state and track in Luna
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      trackValidationError(newErrors);
      return;
    }
    
    // Form is valid, would submit here
    alert('Form submitted successfully!');
    
    // Reset form
    setFormState({
      firstName: '',
      lastName: '',
      email: '',
      gradeLevel: '',
      agreedToTerms: false,
      interests: [],
    });
  };
  
  // Interest options
  const interestOptions = [
    { id: 'math', label: 'Mathematics' },
    { id: 'science', label: 'Science' },
    { id: 'history', label: 'History' },
    { id: 'literature', label: 'Literature' },
    { id: 'arts', label: 'Arts' },
  ];
  
  // Toggle interest selection
  const toggleInterest = (id: string) => {
    const newInterests = formState.interests.includes(id)
      ? formState.interests.filter(i => i !== id)
      : [...formState.interests, id];
    
    handleChange('interests', newInterests);
  };
  
  return (
    <div className="max-w-md mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Student Registration</CardTitle>
          <CardDescription>Fill out this form to register for our platform</CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {/* Personal Information */}
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input 
                id="firstName"
                value={formState.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
                onFocus={() => trackFieldFocus('firstName')}
                onBlur={() => trackFieldBlur('firstName')}
                className={errors.firstName ? 'border-red-500' : ''}
              />
              {errors.firstName && (
                <p className="text-red-500 text-sm">{errors.firstName}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input 
                id="lastName"
                value={formState.lastName}
                onChange={(e) => handleChange('lastName', e.target.value)}
                onFocus={() => trackFieldFocus('lastName')}
                onBlur={() => trackFieldBlur('lastName')}
                className={errors.lastName ? 'border-red-500' : ''}
              />
              {errors.lastName && (
                <p className="text-red-500 text-sm">{errors.lastName}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email"
                type="email"
                value={formState.email}
                onChange={(e) => handleChange('email', e.target.value)}
                onFocus={() => trackFieldFocus('email')}
                onBlur={() => trackFieldBlur('email')}
                className={errors.email ? 'border-red-500' : ''}
              />
              {errors.email && (
                <p className="text-red-500 text-sm">{errors.email}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="gradeLevel">Grade Level</Label>
              <Select 
                value={formState.gradeLevel}
                onValueChange={(value) => handleChange('gradeLevel', value)}
              >
                <SelectTrigger 
                  id="gradeLevel"
                  className={errors.gradeLevel ? 'border-red-500' : ''}
                  onFocus={() => trackFieldFocus('gradeLevel')}
                  onBlur={() => trackFieldBlur('gradeLevel')}
                >
                  <SelectValue placeholder="Select grade level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">6th Grade</SelectItem>
                  <SelectItem value="7">7th Grade</SelectItem>
                  <SelectItem value="8">8th Grade</SelectItem>
                  <SelectItem value="9">9th Grade</SelectItem>
                  <SelectItem value="10">10th Grade</SelectItem>
                  <SelectItem value="11">11th Grade</SelectItem>
                  <SelectItem value="12">12th Grade</SelectItem>
                </SelectContent>
              </Select>
              {errors.gradeLevel && (
                <p className="text-red-500 text-sm">{errors.gradeLevel}</p>
              )}
            </div>
            
            {/* Interests */}
            <div className="space-y-3">
              <Label>Areas of Interest</Label>
              <div className="grid grid-cols-2 gap-2">
                {interestOptions.map((option) => (
                  <div key={option.id} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`interest-${option.id}`}
                      checked={formState.interests.includes(option.id)}
                      onCheckedChange={() => toggleInterest(option.id)}
                      onFocus={() => trackFieldFocus(`interest-${option.id}`)}
                      onBlur={() => trackFieldBlur(`interest-${option.id}`)}
                    />
                    <Label 
                      htmlFor={`interest-${option.id}`}
                      className="text-sm font-normal"
                    >
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Terms Agreement */}
            <div className="flex items-start space-x-2 pt-2">
              <Checkbox 
                id="terms"
                checked={formState.agreedToTerms}
                onCheckedChange={(checked) => 
                  handleChange('agreedToTerms', checked === true)
                }
                onFocus={() => trackFieldFocus('agreedToTerms')}
                onBlur={() => trackFieldBlur('agreedToTerms')}
                className={errors.agreedToTerms ? 'border-red-500' : ''}
              />
              <div className="grid gap-1.5 leading-none">
                <Label 
                  htmlFor="terms"
                  className="text-sm font-normal"
                >
                  I agree to the terms and conditions
                </Label>
                {errors.agreedToTerms && (
                  <p className="text-red-500 text-sm">{errors.agreedToTerms}</p>
                )}
              </div>
            </div>
          </CardContent>
          
          <CardFooter>
            <Button type="submit" className="w-full">
              Register
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
} 