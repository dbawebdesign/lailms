import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { HierarchicalProgressService } from "@/lib/services/hierarchical-progress-service";
import { getActiveProfile } from '@/lib/auth/family-helpers';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ assessmentId: string }> }
) {
    const supabase = createSupabaseServerClient();
    
    // Get the active profile (handles both regular users and sub-accounts)
    const activeProfileData = await getActiveProfile();
    
    if (!activeProfileData) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { profile } = activeProfileData;

    const { assessmentId } = await params;
    
    try {
        const body = await request.json();
        const { 
            status = 'in_progress', 
            progressPercentage = 0, 
            lastPosition = null 
        } = body;

        // Validate assessment exists
        const { data: assessment, error: assessmentError } = await supabase
            .from('assessments')
            .select('id, base_class_id, path_id, lesson_id')
            .eq('id', assessmentId)
            .single();

        if (assessmentError || !assessment) {
            return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
        }

        // Use hierarchical progress service for proper updates
        const progressService = new HierarchicalProgressService(true);
        
        await progressService.updateAssessmentProgress(assessmentId, profile.user_id, {
            status,
            progressPercentage,
            lastPosition
        });

        // Fetch the updated progress record
        const updatedProgress = await progressService.getProgress(profile.user_id, 'assessment', assessmentId);

        return NextResponse.json({ 
            success: true, 
            progress: updatedProgress 
        });

    } catch (error: any) {
        console.error('Error in assessment progress update:', error);
        return NextResponse.json({ 
            error: 'Failed to update assessment progress', 
            details: error.message 
        }, { status: 500 });
    }
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ assessmentId: string }> }
) {
    const supabase = createSupabaseServerClient();
    
    // Get the active profile (handles both regular users and sub-accounts)
    const activeProfileData = await getActiveProfile();
    
    if (!activeProfileData) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { profile } = activeProfileData;
    const { assessmentId } = await params;

    try {
        const progressService = new HierarchicalProgressService(true);
        const progress = await progressService.getProgress(profile.user_id, 'assessment', assessmentId);

        return NextResponse.json({ progress });

    } catch (error: any) {
        console.error('Error fetching assessment progress:', error);
        return NextResponse.json({ 
            error: 'Failed to fetch assessment progress', 
            details: error.message 
        }, { status: 500 });
    }
} 