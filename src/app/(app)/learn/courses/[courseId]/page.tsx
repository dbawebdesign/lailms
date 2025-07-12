import { createSupabaseServerClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import { UserRole } from '@/lib/utils/roleUtils';
import WelcomeCard from '@/components/dashboard/WelcomeCard';
import StudentCourseNavigationTree from '@/components/student/StudentCourseNavigationTree';
import { Tables } from 'packages/types/db';
import CoursePlayerClient from '@/components/student/CoursePlayerClient';

interface CoursePageProps {
  params: Promise<{
    courseId: string;
  }>;
}

// Placeholder for the content player
const ContentPlayer = ({ selectedItemId, selectedItemType }: { selectedItemId?: string, selectedItemType?: string }) => {
  if (!selectedItemId || !selectedItemType) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/20 rounded-lg">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-muted-foreground">Select an item</h2>
          <p className="text-muted-foreground">Choose a lesson or assessment from the navigation to begin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-muted/20 rounded-lg">
      <h3 className="text-xl font-bold mb-4">
        Displaying {selectedItemType}: {selectedItemId}
      </h3>
      {/* TODO: Fetch and render the actual content for the selected item */}
      <p>Content will be loaded here...</p>
    </div>
  );
};


export default async function CoursePage({ params }: CoursePageProps) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Await params in Next.js 15
  const { courseId } = await params;

  const { data: courseInstance, error: courseError } = await supabase
    .from('class_instances')
    .select('name, base_class_id')
    .eq('id', courseId)
    .single<Pick<Tables<'class_instances'>, 'name' | 'base_class_id'>>();

  if (courseError || !courseInstance) {
    notFound();
  }
  
  // The baseClassId needed by the navigation tree might be different
  // from the class_instances id (the courseId param). We should use the one from the db.
  const baseClassId = courseInstance.base_class_id;

  return (
    <div className="container mx-auto p-4 sm:p-6 md:p-8 h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{courseInstance.name}</h1>
        {/* TODO: Add breadcrumbs back to /learn */}
      </div>
      <div className="flex-grow">
        <CoursePlayerClient courseId={baseClassId} />
      </div>
    </div>
  );
} 