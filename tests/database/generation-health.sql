\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAILED: %',label; END IF; END $$;
INSERT INTO course_generation_jobs(id,status,updated_at) SELECT
  ('00000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'processing',now()-interval '1 hour'
FROM generate_series(1,6) n;
INSERT INTO course_generation_tasks(job_id,task_type,task_identifier,status) VALUES
('00000000-0000-0000-0000-000000000001','lesson_section','done','completed'),
('00000000-0000-0000-0000-000000000001','lesson_section','skip','skipped'),
('00000000-0000-0000-0000-000000000002','lesson_section','failed','failed'),
('00000000-0000-0000-0000-000000000003','lesson_section','live','running'),
('00000000-0000-0000-0000-000000000004','lesson_section','stale','running');
INSERT INTO course_generation_queue(job_id,status,locked_at,retry_count,max_retries) VALUES
('00000000-0000-0000-0000-000000000003','processing',now(),0,3),
('00000000-0000-0000-0000-000000000005','processing',now()-interval '1 hour',0,3),
('00000000-0000-0000-0000-000000000006','processing',now()-interval '1 hour',3,3);

SELECT check_job_health();
SELECT pg_temp.check((SELECT status='completed' AND progress_percentage=100 FROM course_generation_jobs WHERE id='00000000-0000-0000-0000-000000000001'),'completed plus skipped tasks reconcile');
SELECT pg_temp.check((SELECT status='failed' FROM course_generation_jobs WHERE id='00000000-0000-0000-0000-000000000002'),'failed tasks reconcile');
SELECT pg_temp.check((SELECT status='processing' FROM course_generation_jobs WHERE id='00000000-0000-0000-0000-000000000003'),'long live job remains active');
SELECT pg_temp.check((SELECT status='running' FROM course_generation_tasks WHERE task_identifier='stale'),'monitor does not restart AI tasks');
SELECT check_job_health();
SELECT pg_temp.check((SELECT count(*)=1 FROM course_generation_logs WHERE job_id='00000000-0000-0000-0000-000000000004'),'stale alert is deduplicated');
SELECT pg_temp.check(cleanup_stale_course_jobs()=2,'only expired leases recovered');
SELECT pg_temp.check((SELECT status='queued' AND retry_count=1 AND locked_at IS NULL FROM course_generation_queue WHERE job_id='00000000-0000-0000-0000-000000000005'),'retry uses deployed queued status');
SELECT pg_temp.check((SELECT status='failed' FROM course_generation_queue WHERE job_id='00000000-0000-0000-0000-000000000006'),'exhausted retry is terminal');
SELECT pg_temp.check((SELECT status='failed' FROM course_generation_jobs WHERE id='00000000-0000-0000-0000-000000000006'),'job reflects retry exhaustion');
SELECT pg_temp.check(cleanup_stale_course_jobs()=0,'cleanup is idempotent');
ROLLBACK;
\echo 'Generation health and lease assertions passed'
