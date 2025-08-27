import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { HierarchicalProgressService } from "@/lib/services/hierarchical-progress-service";
import { getActiveProfile } from '@/lib/auth/family-helpers';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ lessonId: string }> }
) {
    const supabase = createSupabaseServerClient();
    
    // Get the active profile (handles both regular users and sub-accounts)
    const activeProfileData = await getActiveProfile();
    
    if (!activeProfileData) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { profile } = activeProfileData;

    const { lessonId } = await params;
    
    try {
        const body = await request.json();
        const { 
            status = 'in_progress', 
            progressPercentage = 0, 
            lastPosition = null 
        } = body;

        // Validate lesson exists
        const { data: lesson, error: lessonError } = await supabase
            .from('lessons')
            .select('id, base_class_id, path_id')
            .eq('id', lessonId)
            .single();

        if (lessonError || !lesson) {
            return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
        }

        // Use hierarchical progress service for proper updates
        const progressService = new HierarchicalProgressService(true);
        
        await progressService.updateLessonProgress(lessonId, profile.user_id, {
            status,
            progressPercentage,
            lastPosition
        });

        // Fetch the updated progress record
        const updatedProgress = await progressService.getProgress(profile.user_id, 'lesson', lessonId);

        return NextResponse.json({ 
            success: true, 
            progress: updatedProgress 
        });

    } catch (error: any) {
        console.error('Error in lesson progress update:', error);
        return NextResponse.json({ 
            error: 'Failed to update lesson progress', 
            details: error.message 
        }, { status: 500 });
    }
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ lessonId: string }> }
) {
    const supabase = createSupabaseServerClient();
    
    // Get the active profile (handles both regular users and sub-accounts)
    const activeProfileData = await getActiveProfile();
    
    if (!activeProfileData) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { profile } = activeProfileData;
    const { lessonId } = await params;

    try {
        const progressService = new HierarchicalProgressService(true);
        const progress = await progressService.getProgress(profile.user_id, 'lesson', lessonId);

        return NextResponse.json({ progress });

    } catch (error: any) {
        console.error('Error fetching lesson progress:', error);
        return NextResponse.json({ 
            error: 'Failed to fetch lesson progress', 
            details: error.message 
        }, { status: 500 });
    }
} 