import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// Helper to send JSON chunks in the stream
// function streamJson(writableStream: WritableStreamDefaultWriter, data: object) { // Not used with controller.enqueue
//   const jsonString = JSON.stringify(data);
//   const encoder = new TextEncoder();
//   writableStream.write(encoder.encode(`data: ${jsonString}\n\n`));
// }

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ baseClassId: string }> }
) {
  const { baseClassId } = await params;
  console.log(`[STREAMING:generate-all-lessons-content] Received request for baseClassId: ${baseClassId}`);

  if (!baseClassId) {
    return new Response(JSON.stringify({ error: 'Base Class ID is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const supabase = createSupabaseServerClient();

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Authentication required', details: userError?.message || 'No user session found.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
    console.log(`[STREAMING:generate-all-lessons-content] User authenticated: ${user.id} for baseClassId: ${baseClassId}`);

    const { data: pathsData, error: pathsError } = await supabase
      .from('paths')
      .select(`id, title, lessons (id, title, lesson_sections (count))`)
      .eq('base_class_id', baseClassId);

    if (pathsError) {
      return new Response(JSON.stringify({ error: 'Failed to fetch paths and lessons', details: pathsError.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const lessonsToProcess: { id: string; title: string }[] = [];
    let skippedCount = 0;
    if (pathsData) {
      for (const path of pathsData) {
        if (path.lessons) {
          for (const lesson of path.lessons as any[]) {
            if (lesson.lesson_sections && lesson.lesson_sections[0] && lesson.lesson_sections[0].count > 0) {
              skippedCount++;
            } else {
              lessonsToProcess.push({ id: lesson.id, title: lesson.title });
            }
          }
        }
      }
    }
    
    const totalLessonsToProcessInitially = lessonsToProcess.length;
    console.log(`[STREAMING:generate-all-lessons-content] Initial counts - To Process: ${totalLessonsToProcessInitially}, Skipped: ${skippedCount}`);

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const sendEvent = (data: object) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch (e) {
            console.error('[STREAMING:generate-all-lessons-content] Error enqueuing data:', e);
          }
        };
        
        sendEvent({ type: 'start', totalToProcess: totalLessonsToProcessInitially, skipped: skippedCount });

        if (totalLessonsToProcessInitially === 0) {
          sendEvent({ type: 'complete', overallStatus: 'No lessons needed processing.', successfulCount: 0, failedCount: 0, skippedCount });
          controller.close();
          return;
        }

        let successfulGenerationCount = 0;
        let failedGenerationCount = 0;
        const baseUrl = request.nextUrl.origin;

        // Create an array of promises for concurrent execution
        const generationPromises = lessonsToProcess.map(async (lesson, index) => {
          const targetUrl = `${baseUrl}/api/teach/lessons/${lesson.id}/auto-generate-sections`;
          let lessonStatus: 'success' | 'failed' = 'failed';
          let errorDetail: string | undefined;
          const lessonIdentifier = `${lesson.title} (${lesson.id})`;

          try {
            console.log(`[STREAMING:generate-all-lessons-content] Starting generation for lesson ${index + 1}/${totalLessonsToProcessInitially}: ${lessonIdentifier}`);
            const response = await fetch(targetUrl, {
              method: 'POST',
              headers: {
                'Cookie': request.headers.get('Cookie') || '', // Crucial: forward cookies for auth
                'Content-Type': 'application/json',
              },
              // Consider adding a timeout for individual requests if the target API can hang
            });
            
            const responseBody = await response.json().catch(() => ({ message: 'Response not JSON or empty' }));

            if (!response.ok) {
              errorDetail = responseBody.error || responseBody.message || `HTTP status ${response.status}`;
              console.error(`[STREAMING:generate-all-lessons-content] Failed lesson ${lesson.id}. Status: ${response.status}. Error: ${errorDetail}`);
            } else {
              lessonStatus = 'success';
              console.log(`[STREAMING:generate-all-lessons-content] Success for lesson ${lesson.id}.`);
            }
          } catch (err: any) {
            errorDetail = err.message || 'Network or unexpected error during fetch.';
            console.error(`[STREAMING:generate-all-lessons-content] Network/unexpected error for lesson ${lesson.id}:`, err);
          }
          
          return {
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            status: lessonStatus,
            error: errorDetail,
            originalIndex: index, // Keep original index for ordered progress if desired, though not strictly necessary for overall count
          };
        });

        // Execute all promises concurrently and process results as they settle
        const results = await Promise.allSettled(generationPromises);

        let processedCount = 0;
        results.forEach(result => {
          processedCount++;
          if (result.status === 'fulfilled') {
            const data = result.value;
            if (data.status === 'success') {
              successfulGenerationCount++;
            } else {
              failedGenerationCount++;
            }
            sendEvent({
              type: 'progress',
              // currentLessonIndex: data.originalIndex, // Can use this if specific order matters to client
              processedCount: processedCount, // More relevant for concurrent operations
              totalLessonsToProcess: totalLessonsToProcessInitially,
              lessonId: data.lessonId,
              lessonTitle: data.lessonTitle,
              status: data.status,
              error: data.error,
            });
          } else {
            // This case handles errors in the promise creation/setup itself, not API call failures
            failedGenerationCount++; 
            // Attempt to get some info if possible, though lesson details might be lost if promise rejected early
            const reason = result.reason as any;
            sendEvent({
              type: 'progress',
              processedCount: processedCount,
              totalLessonsToProcess: totalLessonsToProcessInitially,
              lessonId: 'unknown', 
              lessonTitle: 'Unknown lesson - promise rejected',
              status: 'failed',
              error: reason?.message || 'Promise rejected for unknown reason',
            });
            console.error('[STREAMING:generate-all-lessons-content] A generation promise was rejected:', reason);
          }
        });
        
        let overallStatus = 'Unknown';
        if (failedGenerationCount === 0 && successfulGenerationCount === totalLessonsToProcessInitially) {
            overallStatus = 'All successful';
        } else if (successfulGenerationCount > 0 && failedGenerationCount > 0) {
            overallStatus = 'Completed with some failures';
        } else if (successfulGenerationCount > 0 && failedGenerationCount === 0) {
            overallStatus = 'All processed tasks successful'; // Should be same as 'All successful'
        } else if (failedGenerationCount > 0 && successfulGenerationCount === 0 && totalLessonsToProcessInitially > 0) {
            overallStatus = 'All failed';
        } else if (totalLessonsToProcessInitially === 0) { // Should be caught earlier
            overallStatus = 'No lessons were processed';
        }


        sendEvent({
          type: 'complete',
          overallStatus,
          successfulCount: successfulGenerationCount,
          failedCount: failedGenerationCount,
          skippedCount,
        });

        console.log(`[STREAMING:generate-all-lessons-content] Stream finished. Success: ${successfulGenerationCount}, Failed: ${failedGenerationCount}, Skipped: ${skippedCount}`);
        controller.close();
      },
      cancel() {
        console.log('[STREAMING:generate-all-lessons-content] Stream cancelled by client.');
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    console.error(`[STREAMING:generate-all-lessons-content] Outer catch error for baseClassId ${baseClassId}:`, error);
    return new Response(JSON.stringify({ error: 'An unexpected server error occurred before streaming could start.', details: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

// GET method to check if content already exists
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ baseClassId: string }> }
) {
  const { baseClassId } = await params;
  const url = new URL(request.url);
  const isCheck = url.searchParams.get('check') === 'true';

  if (!isCheck) {
    return new Response(JSON.stringify({ error: 'Invalid request' }), { 
      status: 400, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  if (!baseClassId) {
    return new Response(JSON.stringify({ error: 'Base Class ID is required' }), { 
      status: 400, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  const supabase = createSupabaseServerClient();

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ 
        error: 'Authentication required', 
        details: userError?.message || 'No user session found.' 
      }), { 
        status: 401, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    const { data: pathsData, error: pathsError } = await supabase
      .from('paths')
      .select(`id, title, lessons (id, title, lesson_sections (count))`)
      .eq('base_class_id', baseClassId);

    if (pathsError) {
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch paths and lessons', 
        details: pathsError.message 
      }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    let lessonsWithContent = 0;
    let totalLessons = 0;

    if (pathsData) {
      for (const path of pathsData) {
        if (path.lessons) {
          for (const lesson of path.lessons as any[]) {
            totalLessons++;
            if (lesson.lesson_sections && lesson.lesson_sections[0] && lesson.lesson_sections[0].count > 0) {
              lessonsWithContent++;
            }
          }
        }
      }
    }

    const hasExistingContent = lessonsWithContent > 0;
    const allLessonsHaveContent = totalLessons > 0 && lessonsWithContent === totalLessons;

    return new Response(JSON.stringify({
      hasExistingContent,
      allLessonsHaveContent,
      totalLessons,
      lessonsWithContent,
      lessonsNeedingContent: totalLessons - lessonsWithContent
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error(`[CHECK:generate-all-lessons-content] Error for baseClassId ${baseClassId}:`, error);
    return new Response(JSON.stringify({ 
      error: 'An unexpected error occurred', 
      details: error.message 
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
} 