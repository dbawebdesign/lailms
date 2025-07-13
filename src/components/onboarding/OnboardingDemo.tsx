/**
 * Onboarding Demo Component
 * 
 * Demonstrates how to integrate the onboarding system with existing components.
 * Shows both basic usage and advanced patterns for different interaction types.
 */

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { OnboardingTooltip } from './OnboardingTooltip';
import { useOnboardingStep } from '@/context/OnboardingContext';
import { Home, User, Settings, Search, Plus, BookOpen } from 'lucide-react';

// Define your onboarding steps
const onboardingSteps = {
  navigation: {
    id: 'navigation',
    title: 'Navigate Your Dashboard',
    description: 'Use this navigation to move between different sections of your learning management system. Each icon represents a different area of functionality.',
    placement: 'right' as const,
    actionType: 'feature-highlight' as const,
    category: 'navigation'
  },
  search: {
    id: 'search',
    title: 'Search Everything',
    description: 'Quickly find any content, course, or resource using our intelligent search. Just click here and start typing!',
    placement: 'bottom' as const,
    actionType: 'action' as const,
    category: 'tools'
  },
  createContent: {
    id: 'create-content',
    title: 'Create New Content',
    description: 'Ready to create? This button lets you add new courses, lessons, or assessments. Click to start building amazing learning experiences.',
    placement: 'bottom' as const,
    actionType: 'action' as const,
    category: 'content'
  },
  profile: {
    id: 'profile',
    title: 'Your Profile',
    description: 'Manage your account settings, preferences, and learning progress. Click here to personalize your experience.',
    placement: 'left' as const,
    actionType: 'info' as const,
    category: 'account'
  }
};

export const OnboardingDemo: React.FC = () => {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  
  // Navigation onboarding
  const navStep = useOnboardingStep('navigation');
  const navRef = useRef<HTMLDivElement>(null);
  
  // Search onboarding
  const searchStep = useOnboardingStep('search');
  const searchRef = useRef<HTMLButtonElement>(null);
  
  // Create content onboarding
  const createStep = useOnboardingStep('create-content');
  const createRef = useRef<HTMLButtonElement>(null);
  
  // Profile onboarding
  const profileStep = useOnboardingStep('profile');
  const profileRef = useRef<HTMLButtonElement>(null);

  const handleElementClick = (stepId: string, element: HTMLElement | null, stepHook: any) => {
    if (stepHook.shouldShow) {
      setTargetElement(element);
      setActiveTooltip(stepId);
    }
    
    // Original click behavior would go here
    console.log(`Clicked ${stepId}`);
  };

  const handleTooltipComplete = (stepId: string) => {
    const stepHook = {
      'navigation': navStep,
      'search': searchStep,
      'create-content': createStep,
      'profile': profileStep
    }[stepId];
    
    stepHook?.markComplete();
    setActiveTooltip(null);
    setTargetElement(null);
  };

  const handleTooltipClose = () => {
    setActiveTooltip(null);
    setTargetElement(null);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="size-5" />
            Onboarding System Demo
          </CardTitle>
          <CardDescription>
            Click on any UI element below to see the onboarding system in action. 
            Each element will only show its tooltip once per user.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge variant={navStep.shouldShow ? "default" : "secondary"}>
              Navigation: {navStep.shouldShow ? "Pending" : "Completed"}
            </Badge>
            <Badge variant={searchStep.shouldShow ? "default" : "secondary"}>
              Search: {searchStep.shouldShow ? "Pending" : "Completed"}
            </Badge>
            <Badge variant={createStep.shouldShow ? "default" : "secondary"}>
              Create: {createStep.shouldShow ? "Pending" : "Completed"}
            </Badge>
            <Badge variant={profileStep.shouldShow ? "default" : "secondary"}>
              Profile: {profileStep.shouldShow ? "Pending" : "Completed"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Mock App Layout */}
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 min-h-[400px]">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <h1 className="text-2xl font-bold">Learning Management System</h1>
          
          <div className="flex items-center gap-4">
            {/* Search Button */}
            <Button
              ref={searchRef}
              variant="outline"
              size="sm"
              onClick={() => handleElementClick('search', searchRef.current, searchStep)}
              className="gap-2"
            >
              <Search className="size-4" />
              Search
            </Button>

            {/* Create Button */}
            <Button
              ref={createRef}
              onClick={() => handleElementClick('create-content', createRef.current, createStep)}
              className="gap-2"
            >
              <Plus className="size-4" />
              Create
            </Button>

            {/* Profile Button */}
            <Button
              ref={profileRef}
              variant="ghost"
              size="sm"
              onClick={() => handleElementClick('profile', profileRef.current, profileStep)}
            >
              <User className="size-4" />
            </Button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-12 gap-6">
          {/* Navigation Sidebar */}
          <div 
            ref={navRef}
            className="col-span-3 bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm cursor-pointer"
            onClick={() => handleElementClick('navigation', navRef.current, navStep)}
          >
            <nav className="space-y-2">
              <div className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <Home className="size-5 text-gray-500" />
                <span>Dashboard</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <BookOpen className="size-5 text-gray-500" />
                <span>Courses</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <Settings className="size-5 text-gray-500" />
                <span>Settings</span>
              </div>
            </nav>
          </div>

          {/* Main Content */}
          <div className="col-span-9">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Welcome to Your Dashboard</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                This is where you'll manage your learning content and track student progress. 
                Click on any element to see the onboarding system in action.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-medium mb-2">Recent Activity</h3>
                    <p className="text-sm text-gray-500">5 new student submissions</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-medium mb-2">Course Progress</h3>
                    <p className="text-sm text-gray-500">3 courses in progress</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Onboarding Tooltips */}
      {activeTooltip && (
        <OnboardingTooltip
          isOpen={true}
          onClose={handleTooltipClose}
          onComplete={handleTooltipComplete}
          step={onboardingSteps[activeTooltip as keyof typeof onboardingSteps]}
          targetElement={targetElement}
          showEntrance={true}
        />
      )}
    </div>
  );
}; 