import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface ClassInstanceData {
  id: string;
  name: string;
  enrollmentCode: string;
  startDate?: string;
  endDate?: string;
  status: "active" | "archived" | "upcoming" | "completed";
  capacity?: number;
  period?: string;
  baseClass: {
    id: string;
    name: string;
  };
}

async function getClassInstanceData(instanceId: string, supabase: any): Promise<ClassInstanceData | null> {
  try {
    const { data: instance, error } = await supabase
      .from('class_instances')
      .select(`
        id,
        name,
        enrollment_code,
        start_date,
        end_date,
        status,
        settings,
        base_classes!inner(
          id,
          name
        )
      `)
      .eq('id', instanceId)
      .single();

    if (error || !instance) {
      return null;
    }

    return {
      id: instance.id,
      name: instance.name,
      enrollmentCode: instance.enrollment_code,
      startDate: instance.start_date,
      endDate: instance.end_date,
      status: instance.status,
      capacity: instance.settings?.capacity,
      period: instance.settings?.period,
      baseClass: {
        id: instance.base_classes.id,
        name: instance.base_classes.name,
      },
    };
  } catch (error) {
    console.error('Error fetching class instance data:', error);
    return null;
  }
}

export default async function ClassInstanceSettingsPage({ 
  params 
}: { 
  params: Promise<{ instanceId: string }> 
}) {
  const { instanceId } = await params;
  const supabase = createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login?error=auth");
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('user_id, first_name, last_name, role')
    .eq('user_id', user.id)
    .single();

  if (profileError || !profile || profile.role !== 'teacher') {
    redirect("/dashboard?error=unauthorized");
  }

  const classInstance = await getClassInstanceData(instanceId, supabase);
  
  if (!classInstance) {
    notFound();
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-success/10 text-success border-success/20";
      case "upcoming": return "bg-info/10 text-info border-info/20";
      case "completed": return "bg-muted/10 text-muted-foreground border-muted/20";
      case "archived": return "bg-warning/10 text-warning border-warning/20";
      default: return "bg-muted/10 text-muted-foreground border-muted/20";
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Link 
            href={`/teach/instances/${classInstance.id}`}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to {classInstance.name}
          </Link>
        </div>
        <h1 className="text-3xl lg:text-[36px] font-bold tracking-tight">
          Class Settings
        </h1>
        <div className="flex items-center gap-3 flex-wrap">
          <Badge 
            variant="outline" 
            className={`px-3 py-1 ${getStatusColor(classInstance.status)}`}
          >
            {classInstance.status.charAt(0).toUpperCase() + classInstance.status.slice(1)}
          </Badge>
          <span className="text-muted-foreground">
            {classInstance.name}
          </span>
        </div>
      </div>

      {/* Settings Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Core settings for your class instance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Class Name</label>
              <p className="font-semibold">{classInstance.name}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Enrollment Code</label>
              <code className="block font-mono text-sm font-semibold bg-muted/30 p-2 rounded">
                {classInstance.enrollmentCode}
              </code>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Based On</label>
              <p className="font-semibold">
                <Link 
                  href={`/teach/base-classes/${classInstance.baseClass.id}`}
                  className="text-primary hover:underline"
                >
                  {classInstance.baseClass.name}
                </Link>
              </p>
            </div>

            {classInstance.period && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Period/Schedule</label>
                <p className="font-semibold">{classInstance.period}</p>
              </div>
            )}

            {classInstance.capacity && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Class Capacity</label>
                <p className="font-semibold">{classInstance.capacity} students</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
            <CardDescription>
              Class duration and important dates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Start Date</label>
              <p className="font-semibold">
                {classInstance.startDate ? 
                  new Date(classInstance.startDate).toLocaleDateString() : 
                  'Not set'
                }
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">End Date</label>
              <p className="font-semibold">
                {classInstance.endDate ? 
                  new Date(classInstance.endDate).toLocaleDateString() : 
                  'Not set'
                }
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <Badge 
                variant="outline" 
                className={`${getStatusColor(classInstance.status)}`}
              >
                {classInstance.status.charAt(0).toUpperCase() + classInstance.status.slice(1)}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Available Actions</CardTitle>
            <CardDescription>
              Manage your class instance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <p>Advanced settings and class management features coming soon</p>
              <p className="text-sm mt-2">
                For now, use the main class page to manage students and content
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 