-- Security Advisor Fixes (2026-02-24)
-- Addresses issues found by Supabase security advisor:
-- 1. ERROR: rls_disabled_in_public - 9 tables without RLS
-- 2. ERROR: security_definer_view - youtube_processing_analytics
-- 3. INFO: rls_enabled_no_policy - 9 tables with RLS but no policies
-- 4. WARN: function_search_path_mutable - 81 functions
-- 5. WARN: rls_policy_always_true - overly permissive policies
-- Remaining manual actions needed:
--   - Enable leaked password protection in Auth settings
--   - Upgrade Postgres version via Supabase dashboard
--   - Move pg_trgm and http extensions out of public schema (if possible)

-- ============================================================
-- 1. Enable RLS on tables missing it
-- ============================================================
ALTER TABLE public.course_generation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_survey_question_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_generation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_generation_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_generation_cache ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. RLS Policies for newly-enabled tables
-- ============================================================

-- course_generation_logs
CREATE POLICY "Users can view their own generation logs"
  ON public.course_generation_logs FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.course_generation_jobs j
      WHERE j.id = course_generation_logs.job_id
        AND j.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert generation logs"
  ON public.course_generation_logs FOR INSERT
  WITH CHECK (auth.role() IN ('service_role', 'authenticated'));

CREATE POLICY "System can update generation logs"
  ON public.course_generation_logs FOR UPDATE
  USING (auth.role() IN ('service_role', 'authenticated'));

-- generations
CREATE POLICY "Users can view their own generations"
  ON public.generations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own generations"
  ON public.generations FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own generations"
  ON public.generations FOR UPDATE
  USING (user_id = auth.uid());

-- generation_citations
CREATE POLICY "Users can view citations for their generations"
  ON public.generation_citations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.generations g
      WHERE g.id = generation_citations.generation_id
        AND g.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert generation citations"
  ON public.generation_citations FOR INSERT
  WITH CHECK (auth.role() IN ('service_role', 'authenticated'));

-- user_analytics
CREATE POLICY "Users can view their own analytics"
  ON public.user_analytics FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System can manage user analytics"
  ON public.user_analytics FOR ALL
  USING (auth.role() IN ('service_role', 'authenticated'))
  WITH CHECK (auth.role() IN ('service_role', 'authenticated'));

-- public_survey_responses (public insert for anonymous survey submissions)
CREATE POLICY "Anyone can submit survey responses"
  ON public.public_survey_responses FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view survey responses"
  ON public.public_survey_responses FOR SELECT
  USING (auth.role() = 'authenticated');

-- public_survey_question_responses
CREATE POLICY "Anyone can insert survey question responses"
  ON public.public_survey_question_responses FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view survey question responses"
  ON public.public_survey_question_responses FOR SELECT
  USING (auth.role() = 'authenticated');

-- course_generation_queue
CREATE POLICY "Users can view their own generation queue entries"
  ON public.course_generation_queue FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.course_generation_jobs j
      WHERE j.id = course_generation_queue.job_id
        AND j.user_id = auth.uid()
    )
  );

CREATE POLICY "System can manage generation queue"
  ON public.course_generation_queue FOR ALL
  USING (auth.role() IN ('service_role', 'authenticated'))
  WITH CHECK (auth.role() IN ('service_role', 'authenticated'));

-- course_generation_evaluations
CREATE POLICY "Users can view evaluations for their jobs"
  ON public.course_generation_evaluations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.course_generation_jobs j
      WHERE j.id = course_generation_evaluations.job_id
        AND j.user_id = auth.uid()
    )
  );

CREATE POLICY "System can manage course generation evaluations"
  ON public.course_generation_evaluations FOR ALL
  USING (auth.role() IN ('service_role', 'authenticated'))
  WITH CHECK (auth.role() IN ('service_role', 'authenticated'));

-- course_generation_cache (internal caching, no user ownership)
CREATE POLICY "System can manage generation cache"
  ON public.course_generation_cache FOR ALL
  USING (auth.role() IN ('service_role', 'authenticated'))
  WITH CHECK (auth.role() IN ('service_role', 'authenticated'));

-- ============================================================
-- 3. Fix SECURITY DEFINER view
-- ============================================================
DROP VIEW IF EXISTS public.youtube_processing_analytics;

CREATE VIEW public.youtube_processing_analytics
  WITH (security_invoker = true)
  AS
  SELECT d.id,
    d.file_name,
    d.status,
    d.file_type,
    d.organisation_id,
    d.created_at,
    d.updated_at,
    d.metadata ->> 'video_id' AS video_id,
    d.metadata ->> 'video_title' AS video_title,
    d.metadata ->> 'video_duration' AS video_duration,
    d.metadata ->> 'channel_name' AS channel_name,
    COALESCE((d.metadata ->> 'processing_attempts')::integer, 0) AS processing_attempts,
    d.metadata ->> 'strategies_tried' AS strategies_tried,
    d.metadata ->> 'final_strategy_used' AS final_strategy_used,
    d.metadata ->> 'transcript_languages_attempted' AS transcript_languages_attempted,
    d.metadata ->> 'error_type' AS error_type,
    d.metadata ->> 'error_message' AS error_message,
    d.metadata ->> 'user_guidance' AS user_guidance,
    EXTRACT(epoch FROM d.updated_at - d.created_at) AS processing_duration_seconds,
    CASE
      WHEN d.status = 'completed' THEN 'success'
      WHEN d.status = 'failed_transcript' THEN 'transcript_unavailable'
      WHEN d.status = 'failed_access' THEN 'access_denied'
      WHEN d.status = 'error' THEN 'processing_error'
      ELSE 'pending'
    END AS processing_outcome
  FROM documents d
  WHERE d.file_type = 'youtube' OR d.file_name LIKE '%youtube.com%' OR d.file_name LIKE '%youtu.be%'
  ORDER BY d.created_at DESC;

-- ============================================================
-- 4. RLS Policies for tables with RLS enabled but no policies
-- ============================================================

-- audit_logs
CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.role() IN ('service_role', 'authenticated'));

-- password_reset_requests (service_role only - security sensitive)
CREATE POLICY "System can manage password reset requests"
  ON public.password_reset_requests FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- members
CREATE POLICY "Users can view members in their organisation"
  ON public.members FOR SELECT
  USING (
    organisation_id IN (
      SELECT p.organisation_id FROM public.profiles p
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "System can manage members"
  ON public.members FOR ALL
  USING (auth.role() IN ('service_role', 'authenticated'))
  WITH CHECK (auth.role() IN ('service_role', 'authenticated'));

-- collaborative_sessions
CREATE POLICY "Creator can manage collaborative sessions"
  ON public.collaborative_sessions FOR ALL
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Participants can view collaborative sessions"
  ON public.collaborative_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.collaborative_participants cp
      JOIN public.members m ON m.id = cp.member_id
      JOIN public.profiles p ON p.organisation_id = m.organisation_id
      WHERE cp.collaborative_session_id = collaborative_sessions.id
        AND p.user_id = auth.uid()
    )
  );

-- collaborative_participants
CREATE POLICY "Users can view participants in their sessions"
  ON public.collaborative_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.collaborative_sessions cs
      WHERE cs.id = collaborative_participants.collaborative_session_id
        AND cs.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.members m
      JOIN public.profiles p ON p.organisation_id = m.organisation_id
      WHERE m.id = collaborative_participants.member_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "System can manage collaborative participants"
  ON public.collaborative_participants FOR ALL
  USING (auth.role() IN ('service_role', 'authenticated'))
  WITH CHECK (auth.role() IN ('service_role', 'authenticated'));

-- ai_tool_interactions
CREATE POLICY "System can manage ai tool interactions"
  ON public.ai_tool_interactions FOR ALL
  USING (auth.role() IN ('service_role', 'authenticated'))
  WITH CHECK (auth.role() IN ('service_role', 'authenticated'));

-- process_analytics
CREATE POLICY "System can manage process analytics"
  ON public.process_analytics FOR ALL
  USING (auth.role() IN ('service_role', 'authenticated'))
  WITH CHECK (auth.role() IN ('service_role', 'authenticated'));

-- proctoring_events
CREATE POLICY "Admins and teachers can view proctoring events"
  ON public.proctoring_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_role IN ('admin', 'super_admin', 'teacher')
    )
  );

CREATE POLICY "System can manage proctoring events"
  ON public.proctoring_events FOR ALL
  USING (auth.role() IN ('service_role', 'authenticated'))
  WITH CHECK (auth.role() IN ('service_role', 'authenticated'));

-- simulation_states
CREATE POLICY "System can manage simulation states"
  ON public.simulation_states FOR ALL
  USING (auth.role() IN ('service_role', 'authenticated'))
  WITH CHECK (auth.role() IN ('service_role', 'authenticated'));

-- ============================================================
-- 5. Tighten previously permissive policies on other tables
-- ============================================================

-- account_migrations: admin-only
DROP POLICY IF EXISTS "Allow migration creation" ON public.account_migrations;
DROP POLICY IF EXISTS "Allow migration deletion" ON public.account_migrations;
DROP POLICY IF EXISTS "Allow migration updates" ON public.account_migrations;

CREATE POLICY "Admins can create account migrations"
  ON public.account_migrations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can delete account migrations"
  ON public.account_migrations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update account migrations"
  ON public.account_migrations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_role IN ('admin', 'super_admin')
    )
  );

-- agent_performance_summary
DROP POLICY IF EXISTS "System can insert agent performance summary" ON public.agent_performance_summary;
DROP POLICY IF EXISTS "System can update agent performance summary" ON public.agent_performance_summary;

CREATE POLICY "System can insert agent performance summary"
  ON public.agent_performance_summary FOR INSERT
  WITH CHECK (auth.role() IN ('service_role', 'authenticated'));

CREATE POLICY "System can update agent performance summary"
  ON public.agent_performance_summary FOR UPDATE
  USING (auth.role() IN ('service_role', 'authenticated'));

-- content_indexing_jobs
DROP POLICY IF EXISTS "System can manage indexing jobs" ON public.content_indexing_jobs;
CREATE POLICY "System can manage indexing jobs"
  ON public.content_indexing_jobs FOR ALL
  USING (auth.role() IN ('service_role', 'authenticated'))
  WITH CHECK (auth.role() IN ('service_role', 'authenticated'));

-- invite_codes
DROP POLICY IF EXISTS "System can create invite codes" ON public.invite_codes;
CREATE POLICY "System can create invite codes"
  ON public.invite_codes FOR INSERT
  WITH CHECK (auth.role() IN ('service_role', 'authenticated'));

-- organisations
DROP POLICY IF EXISTS "Users can create their own organisation" ON public.organisations;
CREATE POLICY "Authenticated users can create organisations"
  ON public.organisations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- study_content_index
DROP POLICY IF EXISTS "System can manage content index" ON public.study_content_index;
CREATE POLICY "System can manage content index"
  ON public.study_content_index FOR ALL
  USING (auth.role() IN ('service_role', 'authenticated'))
  WITH CHECK (auth.role() IN ('service_role', 'authenticated'));

-- ============================================================
-- 6. Fix mutable search_path on all functions
-- ============================================================
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.reorder_sections(uuid[]) SET search_path = public;
ALTER FUNCTION public.is_instructor_for_base_class(uuid) SET search_path = public;
ALTER FUNCTION public.is_enrolled_in_base_class(uuid) SET search_path = public;
ALTER FUNCTION public.handle_feedback_support_updated_at() SET search_path = public;
ALTER FUNCTION public.update_feedback_records_updated_at() SET search_path = public;
ALTER FUNCTION public.trigger_set_timestamp() SET search_path = public;
ALTER FUNCTION public.update_course_generation_tasks_updated_at() SET search_path = public;
ALTER FUNCTION public.get_user_usage_count_last_7_days(uuid) SET search_path = public;
ALTER FUNCTION public.upsert_progress(uuid, text, uuid, text, integer, text) SET search_path = public;
ALTER FUNCTION public.is_class_teacher(uuid) SET search_path = public;
ALTER FUNCTION public.reorder_items_dynamically(text, uuid[]) SET search_path = public;
ALTER FUNCTION public.sync_grade_from_assessment_attempt(uuid) SET search_path = public;
ALTER FUNCTION public.update_agent_performance_summary() SET search_path = public;
ALTER FUNCTION public.update_document_timestamp() SET search_path = public;
ALTER FUNCTION public.cleanup_old_realtime_updates() SET search_path = public;
ALTER FUNCTION public.maintain_section_order() SET search_path = public;
ALTER FUNCTION public.reindex_lessons_after_delete() SET search_path = public;
ALTER FUNCTION public.get_agent_session_context(uuid) SET search_path = public;
ALTER FUNCTION public.update_agent_session_context(uuid, jsonb) SET search_path = public;
ALTER FUNCTION public.is_enrolled_student(uuid) SET search_path = public;
ALTER FUNCTION public.update_timestamp() SET search_path = public;
ALTER FUNCTION public.update_document_processing_metadata(uuid, text, jsonb) SET search_path = public;
ALTER FUNCTION public.log_youtube_processing_attempt(uuid, text, text, jsonb) SET search_path = public;
ALTER FUNCTION public.get_youtube_processing_summary(uuid) SET search_path = public;
ALTER FUNCTION public.join_class_by_code(text) SET search_path = public;
ALTER FUNCTION public.maintain_lesson_order() SET search_path = public;
ALTER FUNCTION public.enroll_student_in_class(text) SET search_path = public;
ALTER FUNCTION public.get_class_instance_student_data(uuid) SET search_path = public;
ALTER FUNCTION public.vector_search_by_user(vector, uuid, double precision, integer) SET search_path = public;
ALTER FUNCTION public.create_default_study_space() SET search_path = public;
ALTER FUNCTION public.maintain_lesson_order_safe() SET search_path = public;
ALTER FUNCTION public.is_student_enrolled_in_class(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.trigger_create_grades_on_student_enrollment() SET search_path = public;
ALTER FUNCTION public.trigger_populate_assignments_on_class_creation() SET search_path = public;
ALTER FUNCTION public.trigger_populate_assignments_on_assessment_creation() SET search_path = public;
ALTER FUNCTION public.update_study_goal_progress() SET search_path = public;
ALTER FUNCTION public.trigger_sync_grade_on_assessment_completion() SET search_path = public;
ALTER FUNCTION public.calculate_attempt_score(uuid) SET search_path = public;
ALTER FUNCTION public.cleanup_expired_insights() SET search_path = public;
ALTER FUNCTION public.set_lesson_section_version_number() SET search_path = public;
ALTER FUNCTION public.insert_survey_response(uuid, integer, jsonb, jsonb) SET search_path = public;
ALTER FUNCTION public.create_lesson_section_with_initial_version(uuid, text, jsonb, integer, text, uuid) SET search_path = public;
ALTER FUNCTION public.update_profile_survey_completed(uuid) SET search_path = public;
ALTER FUNCTION public.update_flashcard_review_schedule() SET search_path = public;
ALTER FUNCTION public.calculate_job_completion_percentage(uuid) SET search_path = public;
ALTER FUNCTION public.validate_question_answer_key(text, jsonb) SET search_path = public;
ALTER FUNCTION public.trigger_content_reindex() SET search_path = public;
ALTER FUNCTION public.create_grades_for_new_student(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.search_study_content(uuid, text, text[], integer, integer) SET search_path = public;
ALTER FUNCTION public.search_study_content(vector, uuid, uuid, text[], double precision, integer) SET search_path = public;
ALTER FUNCTION public.check_task_dependencies_ready(uuid) SET search_path = public;
ALTER FUNCTION public.search_study_content_text(text, uuid, uuid, text[], integer) SET search_path = public;
ALTER FUNCTION public.restart_stuck_job(uuid) SET search_path = public;
ALTER FUNCTION public.populate_assignments_from_assessments(uuid) SET search_path = public;
ALTER FUNCTION public.reindex_sections_after_delete() SET search_path = public;
ALTER FUNCTION public.update_course_generation_rate_limits_updated_at() SET search_path = public;
ALTER FUNCTION public.get_my_claims() SET search_path = public;
ALTER FUNCTION public.get_my_role() SET search_path = public;
ALTER FUNCTION public.get_my_org_id() SET search_path = public;
ALTER FUNCTION public.reorder_paths(uuid, uuid[]) SET search_path = public;
ALTER FUNCTION public.get_public_survey_stats() SET search_path = public;
ALTER FUNCTION public.vector_search(vector, uuid, double precision, integer) SET search_path = public;
ALTER FUNCTION public.get_gradebook_automation_status(uuid) SET search_path = public;
ALTER FUNCTION public.update_study_content_tsvector() SET search_path = public;
ALTER FUNCTION public.reorder_lessons(uuid, uuid[]) SET search_path = public;
ALTER FUNCTION public.increment_rate_limit_counters(uuid) SET search_path = public;
ALTER FUNCTION public.handle_updated_at() SET search_path = public;
ALTER FUNCTION public.user_has_role(role) SET search_path = public;
ALTER FUNCTION public.get_current_role() SET search_path = public;
ALTER FUNCTION public.switch_user_role(role) SET search_path = public;
ALTER FUNCTION public.get_search_suggestions(uuid, text, integer) SET search_path = public;
ALTER FUNCTION public.complete_course_job(uuid) SET search_path = public;
ALTER FUNCTION public.update_assessment_questions_tsvector() SET search_path = public;
ALTER FUNCTION public.update_conversation_message_count() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.update_task_status_direct(uuid, text, jsonb) SET search_path = public;
ALTER FUNCTION public.trigger_job_restart(uuid) SET search_path = public;
ALTER FUNCTION public.release_course_job(uuid) SET search_path = public;
ALTER FUNCTION public.cleanup_stale_course_jobs() SET search_path = public;
ALTER FUNCTION public.safe_upsert_lesson_section(uuid, integer, text, jsonb, text, uuid) SET search_path = public;
ALTER FUNCTION public.reorder_lesson_sections(uuid, uuid[]) SET search_path = public;
ALTER FUNCTION public.get_gradebook_data(uuid) SET search_path = public;
ALTER FUNCTION public.update_class_instance_status() SET search_path = public;
ALTER FUNCTION public.disable_order_maintenance_trigger(text) SET search_path = public;
ALTER FUNCTION public.enable_order_maintenance_trigger(text) SET search_path = public;
ALTER FUNCTION public.update_single_class_instance_status() SET search_path = public;
ALTER FUNCTION public.daily_class_instance_status_update() SET search_path = public;
ALTER FUNCTION public.build_invite_code(role, integer, text, integer) SET search_path = public;
ALTER FUNCTION public.set_default_active_role() SET search_path = public;
ALTER FUNCTION public.check_job_health() SET search_path = public;
ALTER FUNCTION public.trigger_daily_class_status_update() SET search_path = public;
ALTER FUNCTION public.update_order_for_ids(text, text, text, uuid[]) SET search_path = public;
ALTER FUNCTION public.dequeue_course_job(text) SET search_path = public;
ALTER FUNCTION public.generate_enrollment_code() SET search_path = public;
ALTER FUNCTION public.log_audit_event() SET search_path = public;
ALTER FUNCTION public.generate_password_reset_code(text) SET search_path = public;
ALTER FUNCTION public.daily_class_status_update_direct() SET search_path = public;
ALTER FUNCTION public.search_biblical_knowledge(vector, text[], double precision, integer) SET search_path = public;
ALTER FUNCTION public.vector_search_with_base_class(vector, uuid, uuid, double precision, integer) SET search_path = public;
ALTER FUNCTION public.vector_search_for_lesson_generation(vector, uuid, uuid, double precision, integer) SET search_path = public;
