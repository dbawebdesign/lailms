-- Synthetic fixture shaped from the LAI API schema; no production user data.
CREATE SCHEMA auth;
DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF; END $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT auth.jwt()->>'role' $$;
CREATE TYPE public.role AS ENUM ('super_admin', 'admin', 'teacher', 'student', 'parent');
CREATE TYPE public.course_generation_task_type AS ENUM ('lesson_section', 'lesson_assessment', 'lesson_mind_map', 'lesson_brainbytes', 'path_quiz', 'class_exam', 'knowledge_analysis', 'outline_generation', 'content_validation');
CREATE TYPE public.course_generation_task_status AS ENUM ('pending', 'queued', 'running', 'completed', 'failed', 'skipped', 'retrying', 'cancelled');
CREATE TYPE public.course_generation_error_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE public.assessment_type AS ENUM ('practice', 'lesson_quiz', 'path_exam', 'final_exam', 'diagnostic', 'benchmark');
CREATE TYPE public.user_role AS ENUM ('student', 'teacher', 'admin', 'super_admin', 'parent');
CREATE TABLE public.profiles (
  "user_id" uuid PRIMARY KEY,
  "username" text,
  "first_name" text,
  "last_name" text,
  "grade_level" text,
  "role" public.role,
  "organisation_id" uuid,
  "settings" jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "additional_roles" jsonb,
  "active_role" public.role,
  "organisation_unit_id" uuid,
  "survey_completed" boolean DEFAULT false,
  "paid" boolean DEFAULT false,
  "paid_at" timestamp with time zone,
  "stripe_customer_id" text,
  "stripe_payment_intent_id" text,
  "stripe_receipt_url" text,
  "payment_amount_cents" integer,
  "payment_currency" text DEFAULT 'usd',
  "family_id" uuid,
  "is_primary_parent" boolean DEFAULT false,
  "onboarding_completed" boolean DEFAULT false,
  "onboarding_step" text,
  "is_sub_account" boolean DEFAULT false,
  "parent_account_id" uuid,
  "is_canceled" boolean DEFAULT false,
  "stripe_subscription_id" text,
  "subscription_status" text DEFAULT 'active',
  "subscription_cancel_at_period_end" boolean DEFAULT false,
  "subscription_current_period_end" timestamp with time zone
);
GRANT ALL ON public.profiles TO anon, authenticated, service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.course_generation_jobs (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "base_class_id" uuid,
  "organisation_id" uuid,
  "job_type" text,
  "status" text DEFAULT 'queued',
  "progress_percentage" integer DEFAULT 0,
  "job_data" jsonb,
  "result_data" jsonb,
  "error_message" text,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "user_id" uuid,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "is_cleared" boolean DEFAULT false,
  "confetti_shown" boolean DEFAULT false,
  "generation_config" jsonb,
  "performance_metrics" jsonb,
  "retry_configuration" jsonb,
  "user_actions" jsonb,
  "estimated_completion_time" timestamp with time zone,
  "actual_completion_time" timestamp with time zone,
  "total_tasks" integer DEFAULT 0,
  "completed_tasks" integer DEFAULT 0,
  "failed_tasks" integer DEFAULT 0,
  "skipped_tasks" integer DEFAULT 0
);
GRANT ALL ON public.course_generation_jobs TO anon, authenticated, service_role;
ALTER TABLE public.course_generation_jobs ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.course_generation_tasks (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "job_id" uuid,
  "task_type" public.course_generation_task_type,
  "task_identifier" text,
  "status" public.course_generation_task_status DEFAULT 'pending',
  "lesson_id" uuid,
  "path_id" uuid,
  "base_class_id" uuid,
  "section_index" integer,
  "section_title" text,
  "dependencies" text[],
  "execution_priority" integer DEFAULT 0,
  "max_retry_count" integer DEFAULT 3,
  "current_retry_count" integer DEFAULT 0,
  "estimated_duration_seconds" integer,
  "actual_duration_seconds" integer,
  "queued_at" timestamp with time zone,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "last_retry_at" timestamp with time zone,
  "input_data" jsonb,
  "output_data" jsonb,
  "result_metadata" jsonb,
  "error_message" text,
  "error_details" jsonb,
  "error_severity" public.course_generation_error_severity,
  "error_category" text,
  "is_recoverable" boolean DEFAULT true,
  "recovery_suggestions" text[],
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
GRANT ALL ON public.course_generation_tasks TO anon, authenticated, service_role;
ALTER TABLE public.course_generation_tasks ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.course_generation_queue (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "job_id" uuid,
  "priority" integer DEFAULT 5,
  "scheduled_for" timestamp with time zone DEFAULT now(),
  "status" text DEFAULT 'queued',
  "worker_id" text,
  "locked_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "retry_count" integer DEFAULT 0,
  "max_retries" integer DEFAULT 3,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
GRANT ALL ON public.course_generation_queue TO anon, authenticated, service_role;
ALTER TABLE public.course_generation_queue ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.course_generation_cache (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "cache_key" text,
  "content_type" text,
  "cached_content" jsonb,
  "embedding" double precision[],
  "metadata" jsonb,
  "hit_count" integer DEFAULT 0,
  "last_accessed" timestamp with time zone DEFAULT now(),
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
GRANT ALL ON public.course_generation_cache TO anon, authenticated, service_role;
ALTER TABLE public.course_generation_cache ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.user_analytics (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid,
  "assessment_id" uuid,
  "assessment_type" public.assessment_type,
  "best_score" numeric,
  "latest_score" numeric,
  "attempts_count" integer DEFAULT 0,
  "avg_improvement" numeric,
  "learning_velocity" numeric,
  "mastery_level" numeric,
  "time_to_mastery" integer,
  "last_activity_at" timestamp with time zone,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
GRANT ALL ON public.user_analytics TO anon, authenticated, service_role;
ALTER TABLE public.user_analytics ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.course_generation_logs (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "job_id" uuid,
  "level" text,
  "message" text,
  "details" jsonb,
  "timestamp" timestamp with time zone DEFAULT now(),
  "source" text,
  "user_id" uuid,
  "task_id" text,
  "error_code" text,
  "stack_trace" text,
  "created_at" timestamp with time zone DEFAULT now()
);
GRANT ALL ON public.course_generation_logs TO anon, authenticated, service_role;
ALTER TABLE public.course_generation_logs ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.invite_codes (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" text DEFAULT SUBSTRING(md5((random())::text) FROM 1 FOR 10),
  "organisation_id" uuid,
  "role" public.user_role,
  "expires_at" timestamp with time zone,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
GRANT ALL ON public.invite_codes TO anon, authenticated, service_role;
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all read" ON profiles FOR SELECT USING (true);
CREATE POLICY self_update ON profiles FOR UPDATE USING (auth.uid()=user_id);
CREATE POLICY "System can manage generation queue" ON course_generation_queue FOR ALL USING (auth.role() in ('service_role','authenticated'));
CREATE POLICY "System can manage generation cache" ON course_generation_cache FOR ALL USING (auth.role() in ('service_role','authenticated'));
CREATE POLICY "System can manage user analytics" ON user_analytics FOR ALL USING (auth.role() in ('service_role','authenticated'));
CREATE POLICY own_queue ON course_generation_queue FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM course_generation_jobs j WHERE j.id=job_id AND j.user_id=auth.uid()));
CREATE POLICY own_jobs ON course_generation_jobs FOR SELECT TO authenticated USING (user_id=auth.uid());
CREATE POLICY own_analytics ON user_analytics FOR SELECT TO authenticated USING (user_id=auth.uid());
CREATE FUNCTION public.dequeue_course_job(text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN RETURN; END $$;
CREATE FUNCTION public.release_course_job(uuid) RETURNS void LANGUAGE plpgsql AS $$ BEGIN RETURN; END $$;
CREATE FUNCTION public.complete_course_job(uuid) RETURNS void LANGUAGE plpgsql AS $$ BEGIN RETURN; END $$;
CREATE FUNCTION public.cleanup_stale_course_jobs() RETURNS integer LANGUAGE plpgsql AS $$ BEGIN RETURN 0; END $$;
CREATE FUNCTION public.restart_stuck_job(uuid) RETURNS void LANGUAGE plpgsql AS $$ BEGIN RETURN; END $$;
CREATE FUNCTION public.update_task_status_direct(uuid,text,jsonb) RETURNS void LANGUAGE plpgsql AS $$ BEGIN RETURN; END $$;
CREATE FUNCTION public.check_job_health() RETURNS void LANGUAGE plpgsql AS $$ BEGIN RETURN; END $$;
CREATE FUNCTION public.generate_password_reset_code(text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN RETURN; END $$;
CREATE FUNCTION public.switch_user_role(new_role public.role) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN UPDATE public.profiles SET active_role=new_role WHERE user_id=auth.uid(); END $$;

ALTER TABLE course_generation_queue ADD CONSTRAINT course_generation_queue_status_check CHECK (status IN ('queued','processing','completed','failed'));
