BEGIN;

-- Use current schema names. Monitoring never restarts AI work or resets live tasks.
CREATE OR REPLACE FUNCTION public.check_job_health()
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  job_record record;
  total_count integer;
  done_count integer;
  failed_count integer;
  skipped_count integer;
BEGIN
  IF NOT pg_try_advisory_xact_lock(73194622) THEN RETURN; END IF;
  FOR job_record IN
    SELECT id, updated_at, created_at FROM public.course_generation_jobs
    WHERE status = 'processing' FOR UPDATE SKIP LOCKED
  LOOP
    -- A worker can finish one stage and then add tasks for the next stage.
    IF EXISTS (SELECT 1 FROM public.course_generation_queue q
      WHERE q.job_id = job_record.id AND (
        q.status = 'queued' OR
        (q.status = 'processing' AND q.locked_at > now() - interval '10 minutes')
      )) THEN CONTINUE; END IF;

    SELECT count(*), count(*) FILTER (WHERE status = 'completed'),
      count(*) FILTER (WHERE status IN ('failed','cancelled')),
      count(*) FILTER (WHERE status = 'skipped')
    INTO total_count, done_count, failed_count, skipped_count
    FROM public.course_generation_tasks WHERE job_id = job_record.id;

    IF total_count > 0 AND done_count + skipped_count + failed_count = total_count THEN
      UPDATE public.course_generation_jobs
      SET status = CASE WHEN failed_count > 0 THEN 'failed' ELSE 'completed' END,
          progress_percentage = CASE WHEN failed_count = 0 THEN 100 ELSE progress_percentage END,
          completed_tasks = done_count, failed_tasks = failed_count, skipped_tasks = skipped_count,
          completed_at = CASE WHEN failed_count = 0 THEN coalesce(completed_at, now()) ELSE completed_at END,
          updated_at = now(),
          error_message = CASE WHEN failed_count > 0 THEN 'Generation ended with failed or cancelled tasks' ELSE error_message END
      WHERE id = job_record.id;
      INSERT INTO public.course_generation_logs(job_id,level,message,source,details)
      VALUES (job_record.id, CASE WHEN failed_count > 0 THEN 'error' ELSE 'info' END,
        'Health check reconciled terminal task results', 'health_monitor',
        jsonb_build_object('total',total_count,'completed',done_count,'failed',failed_count,'skipped',skipped_count));
    ELSIF coalesce(job_record.updated_at,job_record.created_at) < now() - interval '10 minutes'
      AND NOT EXISTS (SELECT 1 FROM public.course_generation_logs l
        WHERE l.job_id=job_record.id AND l.source='health_monitor'
          AND l.message='Generation needs recovery review; no active worker lease'
          AND l.timestamp >= coalesce(job_record.updated_at,job_record.created_at)) THEN
      INSERT INTO public.course_generation_logs(job_id,level,message,source,details)
      VALUES (job_record.id,'warning','Generation needs recovery review; no active worker lease',
        'health_monitor',jsonb_build_object('last_update',job_record.updated_at,'total_tasks',total_count));
    END IF;
  END LOOP;
END $$;

-- Bound recovery attempts. The worker renews locked_at while generation is running.
CREATE OR REPLACE FUNCTION public.cleanup_stale_course_jobs()
RETURNS integer LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE cleaned_count integer;
BEGIN
  WITH recovered AS (
    UPDATE public.course_generation_queue q
    SET status = CASE WHEN EXISTS (SELECT 1 FROM public.course_generation_jobs j
                          WHERE j.id=q.job_id AND j.status IN ('completed','failed','cancelled'))
                       THEN 'completed'
                      WHEN coalesce(q.retry_count,0) >= coalesce(q.max_retries,3) THEN 'failed'
                      ELSE 'queued' END,
        worker_id = NULL, locked_at = NULL,
        retry_count = coalesce(q.retry_count,0) + 1, updated_at = now()
    WHERE q.status='processing' AND coalesce(q.locked_at,q.updated_at,q.created_at) < now() - interval '10 minutes'
    RETURNING q.job_id,q.status
  ), failed_jobs AS (
    UPDATE public.course_generation_jobs j
    SET status='failed',updated_at=now(),error_message='Worker lease expired; retry limit reached'
    FROM recovered r WHERE r.job_id=j.id AND r.status='failed'
      AND j.status NOT IN ('completed','failed','cancelled')
  ) SELECT count(*) INTO cleaned_count FROM recovered;
  RETURN cleaned_count;
END $$;

REVOKE ALL ON FUNCTION public.check_job_health(),public.cleanup_stale_course_jobs() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.check_job_health(),public.cleanup_stale_course_jobs() TO service_role;
COMMIT;
