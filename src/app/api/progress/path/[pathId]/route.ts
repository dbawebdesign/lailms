import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { HierarchicalProgressService } from "@/lib/services/hierarchical-progress-service";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ pathId: string }> }
) {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pathId } = await params;
    
    try {
        // Validate path exists
        const { data: path, error: pathError } = await supabase
            .from('paths')
            .select('id, base_class_id')
            .eq('id', pathId)
            .single();

        if (pathError || !path) {
            return NextResponse.json({ error: 'Path not found' }, { status: 404 });
        }

        // Use hierarchical progress service to recalculate and update path progress
        const progressService = new HierarchicalProgressService(true);
        
        await progressService.updatePathProgress(pathId, user.id);

        // Fetch the updated progress record
        const updatedProgress = await progressService.getProgress(user.id, 'path', pathId);

        return NextResponse.json({ 
            success: true, 
            progress: updatedProgress 
        });

    } catch (error: any) {
        console.error('Error in path progress update:', error);
        return NextResponse.json({ 
            error: 'Failed to update path progress', 
            details: error.message 
        }, { status: 500 });
    }
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ pathId: string }> }
) {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pathId } = await params;

    try {
        const progressService = new HierarchicalProgressService(true);
        const progress = await progressService.getProgress(user.id, 'path', pathId);

        return NextResponse.json({ progress });

    } catch (error: any) {
        console.error('Error fetching path progress:', error);
        return NextResponse.json({ 
            error: 'Failed to fetch path progress', 
            details: error.message 
        }, { status: 500 });
    }
} 