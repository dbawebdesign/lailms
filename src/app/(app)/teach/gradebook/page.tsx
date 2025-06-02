'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { GradebookShell } from '@/components/teach/gradebook/GradebookShell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  BookOpen, 
  Users, 
  ArrowLeft, 
  Calendar,
  Settings,
  AlertCircle,
  GraduationCap,
  ChevronDown,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClassInstance {
  id: string;
  name: string;
  base_class_id: string;
  enrollment_code: string;
  settings?: any;
  base_class?: {
    id: string;
    name: string;
    description: string;
  } | null;
  enrollments?: Array<{
    id: string;
    profile_id: string;
    role: string;
    status: string;
  }>;
}

export default function GradebookPage() {
  const router = useRouter();
  const [userClasses, setUserClasses] = useState<ClassInstance[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassInstance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useMockData, setUseMockData] = useState(true);

  const mockClasses: ClassInstance[] = [
    {
      id: 'mock-1',
      name: 'Advanced Mathematics',
      base_class_id: 'base-math-advanced',
      enrollment_code: 'MATH2024',
      settings: {},
      base_class: {
        id: 'base-math-advanced',
        name: 'Advanced Mathematics',
        description: 'Advanced mathematical concepts and problem-solving'
      }
    },
    {
      id: 'mock-2', 
      name: 'Biology 101',
      base_class_id: 'base-bio-101',
      enrollment_code: 'BIO2024',
      settings: {},
      base_class: {
        id: 'base-bio-101',
        name: 'Biology 101',
        description: 'Introduction to biological sciences'
      }
    },
    {
      id: 'mock-3',
      name: 'World History',
      base_class_id: 'base-history-world',
      enrollment_code: 'HIST2024',
      settings: {},
      base_class: {
        id: 'base-history-world',
        name: 'World History',
        description: 'Comprehensive world history course'
      }
    }
  ];

  useEffect(() => {
    if (!useMockData && userClasses.length === 0 && !error) {
      loadUserClasses();
    }
  }, [useMockData]);

  const loadMockData = async () => {
    return Promise.resolve();
  };

  const loadUserClasses = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const supabase = createClient();
      
      // Get current user from auth
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Check if user exists in profiles table
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, user_id, role')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profile) {
        throw new Error('User profile not found. Please complete your profile setup.');
      }

      // Get class instances where user is enrolled as teacher
      const { data: instances, error: instancesError } = await supabase
        .from('class_instances')
        .select(`
          id,
          name,
          base_class_id,
          enrollment_code,
          settings,
          base_class:base_classes(
            id,
            name,
            description
          ),
          enrollments!inner(
            id,
            profile_id,
            role,
            status
          )
        `)
        .eq('enrollments.profile_id', profile.id)
        .eq('enrollments.role', 'teacher')
        .eq('enrollments.status', 'active')
        .order('name');

      if (instancesError) {
        throw instancesError;
      }

      // Transform the data to match our interface
      const transformedInstances: ClassInstance[] = (instances || []).map(instance => ({
        ...instance,
        base_class: Array.isArray(instance.base_class) ? instance.base_class[0] || null : instance.base_class
      }));

      setUserClasses(transformedInstances);
      
      // Auto-select first class if only one exists
      if (transformedInstances.length === 1) {
        setSelectedClass(transformedInstances[0]);
      }
    } catch (err) {
      console.error('Error loading classes:', err);
      setError(err instanceof Error ? err.message : 'Failed to load classes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClassSelect = (classId: string) => {
    const classToSelect = useMockData 
      ? mockClasses.find(c => c.id === classId)
      : userClasses.find(c => c.id === classId);
    
    if (classToSelect) {
      setSelectedClass(classToSelect);
    }
  };

  const handleBackToClassSelection = () => {
    setSelectedClass(null);
  };

  const toggleMockData = () => {
    setUseMockData(!useMockData);
    setSelectedClass(null);
    setError(null);
    setIsLoading(false);
  };

  const displayClasses = useMockData ? mockClasses : userClasses;

  // Loading state - only show when actually loading real data
  if (isLoading && !useMockData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading your classes...</p>
        </div>
      </div>
    );
  }

  // Error state - only show when there's an error AND not using mock data
  if (error && !useMockData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Classes</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="space-y-3">
            <Button onClick={loadUserClasses}>Try Again</Button>
            <div className="text-sm text-gray-500">
              or{' '}
              <button 
                onClick={() => setUseMockData(true)}
                className="text-blue-600 hover:text-blue-800 underline"
              >
                use mock data to explore
              </button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // No classes state - only for real data when not using mock
  if (!useMockData && userClasses.length === 0 && !isLoading && !error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 text-center max-w-md">
          <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Classes Found</h2>
          <p className="text-gray-600 mb-4">
            You don't have any active classes to manage grades for.
          </p>
          <div className="space-y-3">
            <Button onClick={() => router.push('/teach/instances')}>
              Create a Class
            </Button>
            <div className="text-sm text-gray-500">
              or{' '}
              <button 
                onClick={() => setUseMockData(true)}
                className="text-blue-600 hover:text-blue-800 underline"
              >
                use mock data to explore
              </button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Class selection view
  if (!selectedClass) {
    return (
      <div className="flex flex-col h-full bg-background">
        {/* Header - Following style guide: clean, spacious */}
        <div className="border-b border-divider bg-surface/50 backdrop-blur-sm">
          <div className="px-8 py-8">
            <div className="text-center space-y-3">
              <h1 className="text-h1 font-bold text-foreground tracking-wide">
                Gradebook
              </h1>
              <p className="text-body text-muted-foreground max-w-2xl mx-auto">
                Select a class to view and manage grades
              </p>
            </div>
          </div>
        </div>

        {/* Mock Data Toggle - Following style guide: clean controls */}
        <div className="px-8 py-6">
          <Card className="p-6 bg-info/5 border-info/20">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="mock-data" 
                    checked={useMockData}
                    onCheckedChange={toggleMockData}
                    className="transition-airy"
                  />
                  <label htmlFor="mock-data" className="text-body font-medium text-foreground cursor-pointer">
                    Use Mock Data
                  </label>
                </div>
                <p className="text-caption text-muted-foreground">
                  {useMockData 
                    ? 'Showing demo classes with sample data' 
                    : 'Showing your actual class instances'}
                </p>
              </div>
              <Badge variant="secondary" className="bg-info/10 text-info border-info/20">
                <Sparkles className="h-3 w-3 mr-1" />
                {useMockData ? 'Demo Mode' : 'Live Data'}
              </Badge>
            </div>
          </Card>
        </div>

        {/* Class Selection Grid - Following style guide: spacious, airy layout */}
        <div className="flex-1 px-8 pb-8">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-4">
                <GraduationCap className="h-16 w-16 text-muted-foreground mx-auto animate-pulse" />
                <div className="space-y-2">
                  <h3 className="text-h3 font-medium text-foreground">Loading classes...</h3>
                  <p className="text-caption text-muted-foreground">Please wait while we load your data</p>
                </div>
              </div>
            </div>
          ) : displayClasses.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-6 max-w-md">
                <div className="p-4 bg-muted/50 rounded-full w-fit mx-auto">
                  <BookOpen className="h-12 w-12 text-muted-foreground" />
                </div>
                <div className="space-y-3">
                  <h3 className="text-h2 font-semibold text-foreground">No classes found</h3>
                  <p className="text-body text-muted-foreground">
                    You don't have any class instances yet. Create a class instance to start grading.
                  </p>
                </div>
                <Button 
                  onClick={() => router.push('/teach')}
                  className="bg-brand-gradient hover:opacity-90 transition-airy shadow-md hover:shadow-lg"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Teaching Dashboard
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayClasses.map((classInstance) => (
                <Card 
                  key={classInstance.id} 
                  className="group cursor-pointer transition-airy hover:shadow-lg hover:-translate-y-1 bg-surface border-divider"
                  onClick={() => handleClassSelect(classInstance.id)}
                >
                  <div className="p-8 space-y-6">
                    {/* Class Icon */}
                    <div className="flex items-center justify-between">
                      <div className="p-3 bg-brand-gradient rounded-xl shadow-sm">
                        <BookOpen className="h-6 w-6 text-white" />
                      </div>
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                        {classInstance.enrollment_code}
                      </Badge>
                    </div>

                    {/* Class Info */}
                    <div className="space-y-3">
                      <h3 className="text-h3 font-semibold text-foreground group-hover:text-primary transition-airy">
                        {classInstance.name}
                      </h3>
                      <p className="text-caption text-muted-foreground leading-relaxed">
                        {classInstance.base_class?.description || 'Class description'}
                      </p>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center justify-between text-caption text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <Users className="h-4 w-4" />
                        <span>{classInstance.enrollments?.length || 0} students</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <GraduationCap className="h-4 w-4" />
                        <span>{classInstance.enrollment_code}</span>
                      </div>
                    </div>

                    {/* Action Button */}
                    <Button 
                      className="w-full bg-brand-gradient hover:opacity-90 transition-airy shadow-sm hover:shadow-md"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClassSelect(classInstance.id);
                      }}
                    >
                      Open Gradebook
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Gradebook view for selected class
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header with Back Button and Class Selector */}
      <div className="border-b border-divider bg-surface/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <Button
                variant="ghost"
                onClick={handleBackToClassSelection}
                className="text-muted-foreground hover:text-foreground transition-airy"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Classes
              </Button>
              
              <div className="h-6 w-px bg-divider" />
              
              <div className="relative">
                <select
                  value={selectedClass.id}
                  onChange={(e) => handleClassSelect(e.target.value)}
                  className="appearance-none bg-background border border-input-border rounded-lg px-4 py-2 pr-10 text-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 transition-airy cursor-pointer"
                >
                  {displayClasses.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} - Period {cls.enrollment_code?.slice(-1) || '5'}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              className="transition-airy hover:shadow-md"
            >
              <Settings className="h-4 w-4 mr-2" />
              Class Settings
            </Button>
          </div>
        </div>
      </div>

      {/* Gradebook Shell */}
      <div className="flex-1 min-h-0">
        <GradebookShell classInstance={selectedClass} />
      </div>
    </div>
  );
} 