import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { updateClassInstanceProgress } from "@/lib/student/progress.server";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ lessonId: string }> }
) {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { lessonId } = await params;
    
    try {
        const body = await request.json();
        const { 
            status = 'in_progress', 
            progressPercentage = 0, 
            lastPosition = null 
        } = body;

        // Validate lesson exists and get base class info
        const { data: lesson, error: lessonError } = await supabase
            .from('lessons')
            .select(`
                id,
                base_class_id,
                path_id
            `)
            .eq('id', lessonId)
            .single();

        if (lessonError || !lesson) {
            return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
        }

        // Update or insert progress using the database function
        const { data: progressId, error } = await supabase.rpc('upsert_progress' as any, {
            p_user_id: user.id,
            p_item_type: 'lesson',
            p_item_id: lessonId,
            p_status: status,
            p_progress_percentage: progressPercentage,
            p_last_position: lastPosition
        });

        if (error) {
            console.error('Error updating lesson progress:', error);
            return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 });
        }

        // Fetch the updated progress record
        const { data, error: fetchError } = await supabase
            .from('progress')
            .select('*')
            .eq('user_id', user.id)
            .eq('item_id', lessonId)
            .single();

        if (fetchError) {
            console.error('Error fetching updated lesson progress:', fetchError);
            return NextResponse.json({ error: 'Failed to fetch updated progress' }, { status: 500 });
        }

        // Update class instance progress
        try {
            // Get the base class ID from the lesson
            const baseClassId = lesson.base_class_id;
            if (baseClassId) {
                // Find the class instance this user is enrolled in for this base class
                const { data: enrollment } = await supabase
                    .from('rosters')
                    .select('class_instances (id)')
                    .eq('profile_id', user.id)
                    .eq('role', 'student')
                    .eq('class_instances.base_class_id', baseClassId)
                    .single();

                if (enrollment?.class_instances?.id) {
                    await updateClassInstanceProgress(enrollment.class_instances.id, user.id);
                }
            }
        } catch (classProgressError) {
            console.error('Error updating class instance progress:', classProgressError);
            // Don't fail the request if class progress update fails
        }

        return NextResponse.json({ 
            success: true, 
            progress: data 
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
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { lessonId } = await params;

    try {
        // Get current progress for this lesson
        const { data: progress, error } = await supabase
            .from('progress')
            .select('*')
            .eq('user_id', user.id)
            .eq('item_type', 'lesson')
            .eq('item_id', lessonId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error('Error fetching lesson progress:', error);
            return NextResponse.json({ error: 'Failed to fetch progress' }, { status: 500 });
        }

        return NextResponse.json({ 
            progress: progress || {
                user_id: user.id,
                item_type: 'lesson',
                item_id: lessonId,
                status: 'not_started',
                progress_percentage: 0,
                last_position: null
            }
        });

    } catch (error: any) {
        console.error('Error fetching lesson progress:', error);
        return NextResponse.json({ 
            error: 'Failed to fetch lesson progress', 
            details: error.message 
        }, { status: 500 });
    }
} 