import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ courseId: string }> }
) {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Await params in Next.js 15
    const { courseId } = await params;

    try {
        // 1. Check if user is enrolled in any class instance that uses this base class
        // First, get all class instances for this base class
        const { data: classInstances, error: classInstancesError } = await supabase
            .from('class_instances')
            .select('id')
            .eq('base_class_id', courseId);

        if (classInstancesError) {
            console.error('Class instances error:', classInstancesError);
            return NextResponse.json({ error: "Error fetching class instances", details: classInstancesError.message }, { status: 500 });
        }

        // Then check if user is enrolled in any of these instances
        const classInstanceIds = classInstances.map(ci => ci.id);
        const { data: enrollment, error: enrollmentError } = await supabase
            .from('rosters')
            .select('id, class_instance_id')
            .eq('profile_id', user.id)
            .in('class_instance_id', classInstanceIds)
            .maybeSingle();

        console.log('Enrollment check:', { enrollment, enrollmentError, userId: user.id, courseId, classInstanceIds });

        if (enrollmentError) {
            console.error('Enrollment error:', enrollmentError);
            return NextResponse.json({ error: "Error checking enrollment", details: enrollmentError.message }, { status: 500 });
        }
        
        if (!enrollment) {
            console.log('User not enrolled in course');
            return NextResponse.json({ error: "Not enrolled in this course" }, { status: 403 });
        }

        // 2. Fetch the base class itself
        const { data: baseClass, error: baseClassError } = await supabase
            .from('base_classes')
            .select('id, name, description')
            .eq('id', courseId)
            .single();

        if (baseClassError) throw baseClassError;

        // 3. Fetch all paths for the class
        const { data: paths, error: pathsError } = await supabase
            .from('paths')
            .select('id, title, description, order_index')
            .eq('base_class_id', courseId)
            .order('order_index');

        if (pathsError) throw pathsError;
        console.log('Fetched paths:', paths);

        // 4. Fetch all lessons and assessments for all paths
        const pathIds = paths.map(p => p.id);
        console.log('Path IDs:', pathIds);
        
        const { data: lessons, error: lessonsError } = await supabase
            .from('lessons')
            .select('*')
            .in('path_id', pathIds)
            .order('order_index');
        
        if (lessonsError) throw lessonsError;
        console.log('Fetched lessons:', lessons);

        const lessonIds = lessons.map(l => l.id);
        console.log('Lesson IDs:', lessonIds);
        
        // Fetch lesson assessments
        const { data: lessonAssessments, error: lessonAssessmentsError } = await supabase
            .from('assessments')
            .select('*')
            .in('lesson_id', lessonIds);
            
        if (lessonAssessmentsError) throw lessonAssessmentsError;
        console.log('Fetched lesson assessments:', lessonAssessments);

        // Fetch path assessments
        const { data: pathAssessments, error: pathAssessmentsError } = await supabase
            .from('assessments')
            .select('*')
            .in('path_id', pathIds);
            
        if (pathAssessmentsError) throw pathAssessmentsError;
        console.log('Fetched path assessments:', pathAssessments);

        // Fetch class assessments
        const { data: classAssessments, error: classAssessmentsError } = await supabase
            .from('assessments')
            .select('*')
            .eq('base_class_id', courseId)
            .is('lesson_id', null)
            .is('path_id', null);
            
        if (classAssessmentsError) throw classAssessmentsError;
        console.log('Fetched class assessments:', classAssessments);

        // 5. Fetch student progress for all items using the unified progress table
        const allAssessments = [...lessonAssessments, ...pathAssessments, ...classAssessments];
        const allItemIds = [...lessonIds, ...allAssessments.map(a => a.id)];
        
        const { data: progressData, error: progressError } = await supabase
            .from('progress')
            .select('item_id, item_type, status, progress_percentage, last_position')
            .eq('user_id', user.id)
            .in('item_id', allItemIds);

        if (progressError) throw progressError;

        // 6. Fetch assessment attempts for scoring data
        const assessmentIds = allAssessments.map(a => a.id);
        const { data: assessmentAttempts, error: attemptsError } = await supabase
            .from('student_attempts')
            .select('assessment_id, percentage_score, passed, status')
            .eq('student_id', user.id)
            .in('assessment_id', assessmentIds)
            .order('created_at', { ascending: false });

        if (attemptsError) throw attemptsError;

        // 7. Create progress maps
        const progressMap = new Map(progressData.map(p => [p.item_id, p]));
        const attemptMap = new Map();
        
        // Get the latest attempt for each assessment
        assessmentAttempts.forEach(attempt => {
            if (!attemptMap.has(attempt.assessment_id)) {
                attemptMap.set(attempt.assessment_id, attempt);
            }
        });

        // 8. Structure the data
        const pathsWithProgress = paths.map(path => {
            const pathLessons = lessons
                .filter(l => l.path_id === path.id)
                .map(lesson => {
                    const lessonProgress = progressMap.get(lesson.id);
                    const lessonAssessmentsForLesson = lessonAssessments
                        .filter(a => a.lesson_id === lesson.id)
                        .map(assessment => {
                            const assessmentProgress = progressMap.get(assessment.id);
                            const latestAttempt = attemptMap.get(assessment.id);
                            
                            return {
                                id: assessment.id,
                                title: assessment.title,
                                assessment_type: 'lesson',
                                time_limit_minutes: assessment.time_limit_minutes,
                                passing_score_percentage: assessment.passing_score_percentage || 70,
                                status: assessmentProgress?.status || 'not_started',
                                score: latestAttempt?.percentage_score || null,
                                attempts: latestAttempt ? 1 : 0, // Count of attempts
                                maxAttempts: assessment.max_attempts,
                                passed: latestAttempt?.passed || false,
                                progress: assessmentProgress?.progress_percentage || 0,
                            };
                        });

                    return {
                        id: lesson.id,
                        title: lesson.title,
                        description: lesson.description || '',
                        order: lesson.order_index || 0,
                        estimatedDurationHours: lesson.estimated_time || 1, // Convert minutes to hours or use default
                        completed: lessonProgress?.status === 'completed',
                        progress: lessonProgress?.progress_percentage || 0,
                        status: lessonProgress?.status || 'not_started',
                        lastPosition: lessonProgress?.last_position,
                        assessments: lessonAssessmentsForLesson,
                    };
                });
            
            // Calculate path progress - weight lessons 80% and assessments 20%
            const totalLessons = pathLessons.length;
            const completedLessons = pathLessons.filter(l => l.completed).length;
            
            // Count all assessments (lesson + path assessments)
            const lessonAssessmentsForPath = pathLessons.flatMap(l => l.assessments);
            const pathAssessmentsForPath = pathAssessments
                .filter(a => a.path_id === path.id)
                .map(assessment => {
                    const assessmentProgress = progressMap.get(assessment.id);
                    const latestAttempt = attemptMap.get(assessment.id);
                    
                    return {
                        id: assessment.id,
                        title: assessment.title,
                        assessment_type: 'path',
                        time_limit_minutes: assessment.time_limit_minutes,
                        passing_score_percentage: assessment.passing_score_percentage || 70,
                        status: assessmentProgress?.status || 'not_started',
                        score: latestAttempt?.percentage_score || null,
                        attempts: latestAttempt ? 1 : 0,
                        maxAttempts: assessment.max_attempts,
                        passed: latestAttempt?.passed || false,
                        progress: assessmentProgress?.progress_percentage || 0,
                    };
                });
            
            const allAssessments = [...lessonAssessmentsForPath, ...pathAssessmentsForPath];
            const completedAssessments = allAssessments.filter(a => a.status === 'completed' || a.status === 'passed').length;
            
            // Weight-based progress calculation: lessons 80%, assessments 20%
            const lessonProgress = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;
            const assessmentProgress = allAssessments.length > 0 ? (completedAssessments / allAssessments.length) * 100 : 0;
            
            // If there are no assessments, lessons count for 100%
            // If there are no lessons, assessments count for 100%
            // Otherwise, apply the 80/20 weighting
            let pathProgress = 0;
            if (totalLessons > 0 && allAssessments.length > 0) {
                pathProgress = Math.round((lessonProgress * 0.8) + (assessmentProgress * 0.2));
            } else if (totalLessons > 0) {
                pathProgress = Math.round(lessonProgress);
            } else if (allAssessments.length > 0) {
                pathProgress = Math.round(assessmentProgress);
            }
            
            // Add path assessments (already calculated above)

            return {
                id: path.id,
                title: path.title,
                description: path.description || '',
                order: path.order_index || 0,
                lessons: pathLessons,
                assessments: pathAssessmentsForPath,
                completed: completedLessons === totalLessons && totalLessons > 0,
                progress: pathProgress,
            };
        });

        // Add class assessments
        const classAssessmentsWithProgress = classAssessments.map(assessment => {
            const assessmentProgress = progressMap.get(assessment.id);
            const latestAttempt = attemptMap.get(assessment.id);
            
            return {
                id: assessment.id,
                title: assessment.title,
                assessment_type: 'class',
                time_limit_minutes: assessment.time_limit_minutes,
                passing_score_percentage: assessment.passing_score_percentage || 70,
                status: assessmentProgress?.status || 'not_started',
                score: latestAttempt?.percentage_score || null,
                attempts: latestAttempt ? 1 : 0,
                maxAttempts: assessment.max_attempts,
                passed: latestAttempt?.passed || false,
                progress: assessmentProgress?.progress_percentage || 0,
            };
        });

        // Calculate overall progress with 80/20 weighting (lessons 80%, assessments 20%)
        const totalPaths = pathsWithProgress.length;
        
        // Calculate total lesson and assessment progress across all paths
        const totalLessons = pathsWithProgress.reduce((sum, path) => sum + path.lessons.length, 0);
        const completedLessons = pathsWithProgress.reduce((sum, path) => 
            sum + path.lessons.filter(l => l.completed).length, 0);
        
        // Count all assessments (lesson + path + class assessments)
        const allPathAssessments = pathsWithProgress.reduce((sum, path) => 
            sum + path.lessons.flatMap(l => l.assessments).length + path.assessments.length, 0);
        const completedPathAssessments = pathsWithProgress.reduce((sum, path) => {
            const lessonAssessments = path.lessons.flatMap(l => l.assessments);
            const pathAssessments = path.assessments;
            const allAssessments = [...lessonAssessments, ...pathAssessments];
            return sum + allAssessments.filter(a => a.status === 'completed' || a.status === 'passed').length;
        }, 0);
        
        const completedClassAssessments = classAssessmentsWithProgress.filter(a => 
            a.status === 'completed' || a.status === 'passed').length;
        
        const totalAssessments = allPathAssessments + classAssessmentsWithProgress.length;
        const completedAssessments = completedPathAssessments + completedClassAssessments;
        
        // Apply 80/20 weighting for overall course progress
        const lessonProgress = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;
        const assessmentProgress = totalAssessments > 0 ? (completedAssessments / totalAssessments) * 100 : 0;
        
        let overallProgress = 0;
        if (totalLessons > 0 && totalAssessments > 0) {
            overallProgress = Math.round((lessonProgress * 0.8) + (assessmentProgress * 0.2));
        } else if (totalLessons > 0) {
            overallProgress = Math.round(lessonProgress);
        } else if (totalAssessments > 0) {
            overallProgress = Math.round(assessmentProgress);
        }

        const responseData = {
            id: baseClass.id,
            title: baseClass.name,
            description: baseClass.description,
            paths: pathsWithProgress,
            classAssessments: classAssessmentsWithProgress,
            overallProgress,
        };

        return NextResponse.json(responseData);

    } catch (error: any) {
        console.error('Error fetching navigation data:', error);
        return NextResponse.json({ error: 'Failed to fetch navigation data', details: error.message }, { status: 500 });
    }
} 