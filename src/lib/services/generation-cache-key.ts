import { createHash } from 'crypto';

/** Cache only an exact task retry inside one job, never another user's course. */
export function generationCacheKey(task: { id?: string; job_id?: string; input_data?: unknown }, request: unknown): string | null {
  if (!task.id || !task.job_id) return null;
  const digest = createHash('sha256').update(JSON.stringify({ task, request })).digest('hex');
  return `task-v2:${task.job_id}:${task.id}:${digest}`;
}
