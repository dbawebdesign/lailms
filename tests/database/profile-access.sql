\set ON_ERROR_STOP on
-- Run only against a disposable database initialized with access-fixture.sql.
BEGIN;
INSERT INTO profiles(user_id, username, role, active_role, organisation_id, family_id,
                     is_primary_parent, is_sub_account, parent_account_id, additional_roles) VALUES
('00000000-0000-0000-0000-000000000001','parent_a','teacher','teacher','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',true,false,null,'["parent"]'),
('00000000-0000-0000-0000-000000000002','child_a','student','student','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',false,true,'00000000-0000-0000-0000-000000000001',null),
('00000000-0000-0000-0000-000000000003','parent_b','teacher','teacher','10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002',true,false,null,'"[\"admin\"]"'),
('00000000-0000-0000-0000-000000000004','child_b','student','student','10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002',false,true,'00000000-0000-0000-0000-000000000003',null);
INSERT INTO course_generation_jobs(id,user_id) VALUES
('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001'),
('30000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003');
INSERT INTO course_generation_queue(job_id) VALUES
('30000000-0000-0000-0000-000000000001'),('30000000-0000-0000-0000-000000000002');
INSERT INTO user_analytics(user_id) VALUES
('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000003');

CREATE FUNCTION pg_temp.assert_true(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAILED: %', label; END IF; END $$;
CREATE FUNCTION pg_temp.denied(statement text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE statement; EXCEPTION WHEN insufficient_privilege THEN RETURN; END;
  RAISE EXCEPTION 'Expected permission denial: %', statement;
END $$;

SET LOCAL ROLE anon;
SELECT pg_temp.denied('SELECT * FROM profiles');
SELECT pg_temp.denied('SELECT * FROM invite_codes');
SELECT pg_temp.denied('SELECT * FROM course_generation_cache');
SELECT pg_temp.denied('SELECT check_job_health()');
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000001"}',true);
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM profiles), 'parent sees own family, not other tenant');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM course_generation_queue), 'queue reads stay scoped to own job');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM user_analytics), 'analytics reads stay scoped to own account');
UPDATE profiles SET first_name='Updated' WHERE user_id=auth.uid();
UPDATE profiles SET grade_level='5' WHERE username='child_a';
SELECT pg_temp.assert_true((SELECT grade_level='5' FROM profiles WHERE username='child_a'), 'parent edits own student');
UPDATE profiles SET active_role='parent' WHERE user_id=auth.uid();
SELECT switch_user_role('teacher');
SELECT pg_temp.denied($s$UPDATE profiles SET role='super_admin' WHERE user_id=auth.uid()$s$);
SELECT pg_temp.denied($s$UPDATE profiles SET paid=true WHERE user_id=auth.uid()$s$);
SELECT pg_temp.denied($s$UPDATE profiles SET additional_roles='["admin"]' WHERE user_id=auth.uid()$s$);
SELECT pg_temp.denied($s$UPDATE profiles SET organisation_id='10000000-0000-0000-0000-000000000002' WHERE user_id=auth.uid()$s$);
SELECT pg_temp.denied($s$UPDATE profiles SET is_primary_parent=true WHERE username='child_a'$s$);
SELECT pg_temp.denied($s$UPDATE profiles SET active_role='admin' WHERE user_id=auth.uid()$s$);
SELECT pg_temp.denied($s$SELECT switch_user_role('super_admin')$s$);
SELECT pg_temp.denied('DELETE FROM profiles WHERE user_id=auth.uid()');
SELECT pg_temp.denied($s$INSERT INTO profiles(user_id,role) VALUES (auth.uid(),'admin')$s$);
SELECT pg_temp.denied('UPDATE course_generation_queue SET status=''pending''');
SELECT pg_temp.denied('SELECT * FROM course_generation_cache');
SELECT pg_temp.denied('DELETE FROM user_analytics');
SELECT pg_temp.denied($s$INSERT INTO invite_codes(code,role) VALUES ('forged','super_admin')$s$);
SELECT pg_temp.denied($s$SELECT dequeue_course_job('fake-worker')$s$);

SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000002"}',true);
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM profiles), 'student reads only self');
SELECT pg_temp.denied($s$UPDATE profiles SET active_role='teacher' WHERE user_id=auth.uid()$s$);
SELECT pg_temp.denied($s$SELECT switch_user_role('admin')$s$);
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000003"}',true);
SELECT pg_temp.denied($s$UPDATE profiles SET active_role='admin' WHERE user_id=auth.uid()$s$);
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
UPDATE profiles SET paid=true WHERE username='parent_a';
INSERT INTO profiles(user_id,role) VALUES ('00000000-0000-0000-0000-000000000005','teacher');
SELECT pg_temp.assert_true((SELECT count(*)=5 FROM profiles), 'trusted provisioning and billing remain available');
ROLLBACK;
\echo 'Profile, invite and internal access assertions passed'
