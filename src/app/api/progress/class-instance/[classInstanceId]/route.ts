import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { updateClassInstanceProgress } from "@/lib/student/progress.server";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ classInstanceId: string }> }
) {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { classInstanceId } = await params;
    
    try {
        const body = await request.json();
        const { userId = user.id } = body;

        // Verify the user has access to this class instance
        const { data: enrollment, error: enrollmentError } = await supabase
            .from('rosters')
            .select('id')
            .eq('profile_id', userId)
            .eq('class_instance_id', classInstanceId)
            .eq('role', 'student')
            .single();

        if (enrollmentError || !enrollment) {
            return NextResponse.json({ 
                error: 'User not enrolled in this class instance' 
            }, { status: 403 });
        }

        // Update class instance progress
        await updateClassInstanceProgress(classInstanceId, userId);

        return NextResponse.json({ 
            success: true,
            message: 'Class instance progress updated successfully'
        });

    } catch (error: any) {
        console.error('Error updating class instance progress:', error);
        return NextResponse.json({ 
            error: 'Failed to update class instance progress', 
            details: error.message 
        }, { status: 500 });
    }
} 