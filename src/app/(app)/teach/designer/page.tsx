'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { createBrowserClient } from '@supabase/ssr';
import { BookOpen, PenLine, Sparkles, ArrowRight } from 'lucide-react';
import Link from 'next/link';

// Placeholder for the actual course outline data structure
// We'll likely pass data to this page or fetch it based on an ID
interface CourseOutlineData {
  // Define structure based on what /api/teach/generate-course-outline returns
  // or what a saved BaseClass structure would look like when expanded.
  baseClassName?: string;
  description?: string;
  modules?: Array<{ title: string; topics: string[]; suggestedLessons?: any[] }>;
}

export default function TeachDesignerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const baseClassId = searchParams.get('baseClassId');
  const [recentBaseClasses, setRecentBaseClasses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // If baseClassId is provided, redirect to the specific base class detail page
  useEffect(() => {
    if (baseClassId) {
      router.push(`/teach/base-classes/${baseClassId}?id=${baseClassId}`);
    } else {
      // Load recent base classes
      const fetchRecentBaseClasses = async () => {
        try {
          const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
          );
          const { data, error } = await supabase
            .from('base_classes')
            .select('id, name, description, settings, created_at')
            .order('created_at', { ascending: false })
            .limit(3);
            
          if (error) throw error;
          setRecentBaseClasses(data || []);
        } catch (err) {
          console.error('Error fetching recent base classes:', err);
        } finally {
          setIsLoading(false);
        }
      };

      fetchRecentBaseClasses();
    }
  }, [baseClassId, router]);

  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <p>Loading Course Designer...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-6 max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
          Course Designer
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Create, customize, and manage your courses with our intuitive design tools
        </p>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Create from scratch */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center">
              <PenLine className="h-5 w-5 mr-2 text-primary" />
              Create from Scratch
            </CardTitle>
            <CardDescription>
              Build a course structure manually with our intuitive designer
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Start with a blank canvas and build your course structure, lessons, and assessments exactly how you want them.
            </p>
          </CardContent>
          <CardFooter>
            <Button className="w-full">
              Create New Base Class <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
        
        {/* AI-Generated Course */}
        <Card className="hover:shadow-lg transition-shadow border-primary/20">
          <CardHeader className="bg-primary/5">
            <CardTitle className="flex items-center">
              <Sparkles className="h-5 w-5 mr-2 text-primary" />
              AI-Generated Course
            </CardTitle>
            <CardDescription>
              Let our Class Co-Pilot generate a course structure for you
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Describe your course in natural language, and our AI will generate a complete structure with modules, lessons, and assessments.
            </p>
          </CardContent>
          <CardFooter>
            <Button variant="default" className="w-full" asChild>
              <Link href="/luna">
                Use Class Co-Pilot <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>
        
        {/* Browse Existing */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center">
              <BookOpen className="h-5 w-5 mr-2 text-primary" />
              Browse Existing
            </CardTitle>
            <CardDescription>
              View and edit your existing base classes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Edit, customize, or create instances of your previously created courses.
            </p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/teach/base-classes">
                View All Base Classes <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
      
      {/* Recent Base Classes */}
      {recentBaseClasses.length > 0 && (
        <div className="mt-12">
          <h2 className="text-xl font-semibold mb-4">Recently Created Courses</h2>
          <div className="space-y-3">
            {recentBaseClasses.map((baseClass) => (
              <Card key={baseClass.id} className="hover:bg-muted/30 transition-colors">
                <CardHeader className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{baseClass.name}</CardTitle>
                      <CardDescription className="line-clamp-1">
                        {baseClass.description || 'No description'}
                      </CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/teach/base-classes/${baseClass.id}`}>
                        Open <ArrowRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 