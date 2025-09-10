'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  BookOpen, 
  Brain, 
  Clock,
  Zap,
  Timer,
  ArrowRight,
  Sparkles,
  Settings,
  FileText,
  Search
} from 'lucide-react';
import { CourseCatalogGradeLevelSelector } from './CourseCatalogGradeLevelSelector';

interface CourseCreationOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  organisationId: string;
}

export function CourseCreationOptionsModal({ 
  isOpen, 
  onClose, 
  organisationId 
}: CourseCreationOptionsModalProps) {
  const router = useRouter();
  const [showCatalogSelector, setShowCatalogSelector] = useState(false);

  const handleCreateYourOwn = () => {
    onClose();
    router.push('/teach/knowledge-base/create');
  };

  const handleChooseFromCatalog = () => {
    setShowCatalogSelector(true);
  };

  const handleCatalogSelection = (courseId: string, courseName: string) => {
    onClose();
    // Optionally show a success message or redirect
    window.location.reload(); // Refresh to show the new course
  };

  const handleBackToCatalog = () => {
    setShowCatalogSelector(false);
  };

  const handleDeepResearch = () => {
    // Coming soon - could show a toast or modal
    alert('Deep Research course creation is coming soon!');
  };

  if (showCatalogSelector) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Choose from Course Catalog
            </DialogTitle>
            <DialogDescription>
              Select your grade level first, then choose from our pre-built courses.
            </DialogDescription>
          </DialogHeader>
          
          <CourseCatalogGradeLevelSelector 
            onCourseSelected={handleCatalogSelection}
            onBack={handleBackToCatalog}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[1000px] overflow-visible max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            Create Your Course
          </DialogTitle>
          <DialogDescription className="text-center text-lg">
            Choose how you'd like to create your new course
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-6 px-6 min-h-[400px]">
          {/* Create Your Own Course */}
          <Card className="relative hover:shadow-lg transition-shadow cursor-pointer group border-blue-200 dark:border-blue-800 flex flex-col h-full" onClick={handleCreateYourOwn}>
            <div className="absolute top-3 right-3 z-10">
              <Badge className="bg-blue-500 hover:bg-blue-600 text-white shadow-lg">
                <Settings className="h-3 w-3 mr-1" />
                Most Control
              </Badge>
            </div>
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/40 transition-colors">
                <Upload className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle className="text-lg">Create Your Own Course</CardTitle>
              <div className="flex items-center justify-center gap-2 mt-2">
                <Badge variant="outline" className="text-xs">
                  <FileText className="h-3 w-3 mr-1" />
                  Custom Sources
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="text-center flex flex-col flex-1">
              <div className="flex-1">
                <CardDescription className="text-sm leading-relaxed mb-4">
                  Upload your own documents and resources. 
                  Our AI will transform them into a comprehensive course with lessons, 
                  assessments, and activities tailored to your specific content.
                </CardDescription>
                <div className="text-xs text-muted-foreground mb-4 text-left">
                  <div>• Upload PDFs, Word docs, videos</div>
                  <div>• AI generates structured lessons from YOUR content</div>
                  <div>• Maximum customization & control</div>
                </div>
              </div>
              <Button className="w-full group-hover:bg-blue-600 mt-auto" onClick={handleCreateYourOwn}>
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Choose from Catalog */}
          <Card className="relative hover:shadow-lg transition-shadow cursor-pointer group border-green-200 dark:border-green-800 flex flex-col h-full" onClick={handleChooseFromCatalog}>
            <div className="absolute top-3 right-3 z-10">
              <Badge className="bg-green-500 hover:bg-green-600 text-white shadow-lg">
                <Zap className="h-3 w-3 mr-1" />
                Fastest
              </Badge>
            </div>
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-4 group-hover:bg-green-200 dark:group-hover:bg-green-900/40 transition-colors">
                <BookOpen className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-lg">Choose from Our Catalog</CardTitle>
              <div className="flex items-center justify-center gap-2 mt-2">
                <Badge variant="outline" className="text-xs border-green-200 text-green-700 dark:text-green-400">
                  <Zap className="h-3 w-3 mr-1" />
                  Quick & Easy
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="text-center flex flex-col flex-1">
              <div className="flex-1">
                <CardDescription className="text-sm leading-relaxed mb-4">
                  Start with professionally designed courses for K-12 subjects. 
                  Choose your grade level and subject, then customize the course 
                  to fit your classroom needs.
                </CardDescription>
                <div className="text-xs text-muted-foreground mb-4 text-left">
                  <div>• Pre-built lessons & assessments</div>
                  <div>• Aligned to educational standards</div>
                  <div>• Ready to use immediately</div>
                </div>
              </div>
              <Button className="w-full bg-green-600 hover:bg-green-700 mt-auto" onClick={handleChooseFromCatalog}>
                Browse Catalog
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Deep Research */}
          <Card className="relative hover:shadow-lg transition-shadow cursor-pointer group opacity-75 flex flex-col h-full" onClick={handleDeepResearch}>
            <div className="absolute top-3 right-3 z-10">
              <Badge variant="secondary" className="shadow-lg">
                Coming Soon
              </Badge>
            </div>
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mb-4 group-hover:bg-purple-200 dark:group-hover:bg-purple-900/40 transition-colors">
                <Brain className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
              <CardTitle className="text-lg">Create from Deep Research</CardTitle>
              <div className="flex items-center justify-center gap-2 mt-2">
                <Badge variant="outline" className="text-xs">
                  <Search className="h-3 w-3 mr-1" />
                  Exploratory
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="text-center flex flex-col flex-1">
              <div className="flex-1">
                <CardDescription className="text-sm leading-relaxed mb-4">
                  Our AI conducts deep research on your topic using the latest 
                  academic sources and creates a cutting-edge course with the 
                  most current information available.
                </CardDescription>
                <div className="text-xs text-muted-foreground mb-4 text-left">
                  <div>• AI-powered research & content creation</div>
                  <div>• Latest academic sources</div>
                  <div>• Comprehensive topic coverage</div>
                </div>
              </div>
              <Button variant="outline" className="w-full mt-auto" disabled>
                <Sparkles className="mr-2 h-4 w-4" />
                Coming Soon
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center text-sm text-muted-foreground border-t pt-4 space-y-2">
          <div>
            Need help choosing? Start with our <strong>Course Catalog</strong> for the quickest setup, 
            or <strong>Create Your Own</strong> if you have specific materials to use.
          </div>
          <div className="text-xs bg-muted/30 rounded-lg p-3 mt-3">
            <strong>Complete Control:</strong> No matter which option you choose, all generated content is fully editable. 
            You maintain complete control to customize, modify, and personalize your course exactly how you want it.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
