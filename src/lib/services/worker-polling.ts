export function intervalMs(value: string | undefined, fallback: number, minimum = 1000, maximum = 60000): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

/** Fast while busy; bounded exponential backoff when idle or Supabase fails. */
export class AdaptivePollDelay {
  private delay: number;
  constructor(private readonly base: number, private readonly maximum: number) {
    this.delay = base;
  }
  next(foundWork: boolean): number {
    const result = foundWork ? this.base : this.delay;
    this.delay = foundWork ? this.base : Math.min(this.maximum, this.delay * 2);
    return result;
  }
}

/** Wait after each run completes so a slow request never creates overlapping runs. */
export function schedulePeriodic(task: () => void | Promise<void>, delay: number, onError: (error: unknown) => void): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  const schedule = () => {
    timer = setTimeout(async () => {
      try { await task(); } catch (error) { onError(error); }
      if (!stopped) schedule();
    }, delay);
    timer.unref?.();
  };
  schedule();
  return () => { stopped = true; clearTimeout(timer); };
}
