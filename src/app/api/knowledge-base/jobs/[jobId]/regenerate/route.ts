import { NextResponse } from 'next/server';
import { courseGenerationOrchestrator } from '@/lib/services/course-generation-orchestrator';

export async function POST(
  request: Request,
  { params }: { params: { jobId: string } }
) {
  const { jobId } = params;
  const { taskId } = await request.json();

  if (!jobId || !taskId) {
    return NextResponse.json(
      { error: 'Missing jobId or taskId' },
      { status: 400 }
    );
  }

  try {
    const success = await courseGenerationOrchestrator.regenerateTask(jobId, taskId);

    if (success) {
      return NextResponse.json({ message: 'Task regeneration started' });
    } else {
      return NextResponse.json(
        { error: 'Failed to regenerate task. Job or task not found, or task not in failed state.' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Error regenerating task:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 