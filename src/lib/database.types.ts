export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      agent_analytics: {
        Row: {
          agent_type: string
          average_response_time: number | null
          created_at: string | null
          id: string
          interaction_count: number | null
          session_id: string
          success_rate: number | null
          tools_used: Json | null
          updated_at: string | null
          user_id: string | null
          user_satisfaction: number | null
        }
        Insert: {
          agent_type: string
          average_response_time?: number | null
          created_at?: string | null
          id?: string
          interaction_count?: number | null
          session_id: string
          success_rate?: number | null
          tools_used?: Json | null
          updated_at?: string | null
          user_id?: string | null
          user_satisfaction?: number | null
        }
        Update: {
          agent_type?: string
          average_response_time?: number | null
          created_at?: string | null
          id?: string
          interaction_count?: number | null
          session_id?: string
          success_rate?: number | null
          tools_used?: Json | null
          updated_at?: string | null
          user_id?: string | null
          user_satisfaction?: number | null
        }
        Relationships: []
      }
      agent_messages: {
        Row: {
          agent_type: string
          citations: Json | null
          content: string
          created_at: string | null
          id: string
          metadata: Json | null
          role: string
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          agent_type: string
          citations?: Json | null
          content: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role: string
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          agent_type?: string
          citations?: Json | null
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: string
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "agent_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_performance_summary: {
        Row: {
          agent_type: string
          average_response_time: number | null
          created_at: string | null
          date: string
          id: string
          satisfaction_score: number | null
          successful_interactions: number | null
          total_interactions: number | null
          total_tool_uses: number | null
          unique_users: number | null
          updated_at: string | null
        }
        Insert: {
          agent_type: string
          average_response_time?: number | null
          created_at?: string | null
          date: string
          id?: string
          satisfaction_score?: number | null
          successful_interactions?: number | null
          total_interactions?: number | null
          total_tool_uses?: number | null
          unique_users?: number | null
          updated_at?: string | null
        }
        Update: {
          agent_type?: string
          average_response_time?: number | null
          created_at?: string | null
          date?: string
          id?: string
          satisfaction_score?: number | null
          successful_interactions?: number | null
          total_interactions?: number | null
          total_tool_uses?: number | null
          unique_users?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      content_indexing_jobs: {
        Row: {
          base_class_id: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          organisation_id: string
          processed_items: number | null
          progress: number | null
          started_at: string | null
          stats: Json | null
          status: string
          total_items: number | null
          updated_at: string
        }
        Insert: {
          base_class_id: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          organisation_id: string
          processed_items?: number | null
          progress?: number | null
          started_at?: string | null
          stats?: Json | null
          status?: string
          total_items?: number | null
          updated_at?: string
        }
        Update: {
          base_class_id?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          organisation_id?: string
          processed_items?: number | null
          progress?: number | null
          started_at?: string | null
          stats?: Json | null
          status?: string
          total_items?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      content_reindex_queue: {
        Row: {
          base_class_id: string
          created_at: string
          error_message: string | null
          id: string
          priority: string
          processed_at: string | null
          source_id: string
          source_table: string
          status: string
        }
        Insert: {
          base_class_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          priority?: string
          processed_at?: string | null
          source_id: string
          source_table: string
          status?: string
        }
        Update: {
          base_class_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          priority?: string
          processed_at?: string | null
          source_id?: string
          source_table?: string
          status?: string
        }
        Relationships: []
      }
      course_generation_analytics: {
        Row: {
          api_calls_failed: number | null
          api_calls_made: number | null
          average_task_time_seconds: number | null
          avg_cpu_usage_percent: number | null
          baseline_time_comparison_percent: number | null
          cache_hit_rate: number | null
          content_quality_score: number | null
          created_at: string | null
          database_queries_count: number | null
          estimated_cost_usd: number | null
          id: string
          job_id: string
          knowledge_base_size_mb: number | null
          peak_memory_usage_mb: number | null
          previous_job_improvement_percent: number | null
          success_rate: number | null
          tokens_consumed: number | null
          total_assessments_generated: number | null
          total_generation_time_seconds: number | null
          total_lessons_generated: number | null
          total_sections_generated: number | null
          updated_at: string | null
          user_satisfaction_score: number | null
        }
        Insert: {
          api_calls_failed?: number | null
          api_calls_made?: number | null
          average_task_time_seconds?: number | null
          avg_cpu_usage_percent?: number | null
          baseline_time_comparison_percent?: number | null
          cache_hit_rate?: number | null
          content_quality_score?: number | null
          created_at?: string | null
          database_queries_count?: number | null
          estimated_cost_usd?: number | null
          id?: string
          job_id: string
          knowledge_base_size_mb?: number | null
          peak_memory_usage_mb?: number | null
          previous_job_improvement_percent?: number | null
          success_rate?: number | null
          tokens_consumed?: number | null
          total_assessments_generated?: number | null
          total_generation_time_seconds?: number | null
          total_lessons_generated?: number | null
          total_sections_generated?: number | null
          updated_at?: string | null
          user_satisfaction_score?: number | null
        }
        Update: {
          api_calls_failed?: number | null
          api_calls_made?: number | null
          average_task_time_seconds?: number | null
          avg_cpu_usage_percent?: number | null
          baseline_time_comparison_percent?: number | null
          cache_hit_rate?: number | null
          content_quality_score?: number | null
          created_at?: string | null
          database_queries_count?: number | null
          estimated_cost_usd?: number | null
          id?: string
          job_id?: string
          knowledge_base_size_mb?: number | null
          peak_memory_usage_mb?: number | null
          previous_job_improvement_percent?: number | null
          success_rate?: number | null
          tokens_consumed?: number | null
          total_assessments_generated?: number | null
          total_generation_time_seconds?: number | null
          total_lessons_generated?: number | null
          total_sections_generated?: number | null
          updated_at?: string | null
          user_satisfaction_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "course_generation_analytics_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "course_generation_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      course_generation_errors: {
        Row: {
          created_at: string | null
          error_category: string
          error_context: Json | null
          error_message: string
          error_severity: Database["public"]["Enums"]["course_generation_error_severity"]
          error_stack: string | null
          error_type: string
          id: string
          is_retryable: boolean | null
          job_id: string
          request_metadata: Json | null
          resolution_method: string | null
          resolution_notes: string | null
          resolved_at: string | null
          retry_strategy: string | null
          suggested_actions: string[] | null
          system_metrics: Json | null
          task_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_category: string
          error_context?: Json | null
          error_message: string
          error_severity: Database["public"]["Enums"]["course_generation_error_severity"]
          error_stack?: string | null
          error_type: string
          id?: string
          is_retryable?: boolean | null
          job_id: string
          request_metadata?: Json | null
          resolution_method?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          retry_strategy?: string | null
          suggested_actions?: string[] | null
          system_metrics?: Json | null
          task_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_category?: string
          error_context?: Json | null
          error_message?: string
          error_severity?: Database["public"]["Enums"]["course_generation_error_severity"]
          error_stack?: string | null
          error_type?: string
          id?: string
          is_retryable?: boolean | null
          job_id?: string
          request_metadata?: Json | null
          resolution_method?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          retry_strategy?: string | null
          suggested_actions?: string[] | null
          system_metrics?: Json | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_generation_errors_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "course_generation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_generation_errors_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "course_generation_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      course_generation_jobs: {
        Row: {
          actual_completion_time: string | null
          base_class_id: string | null
          completed_at: string | null
          completed_tasks: number | null
          confetti_shown: boolean | null
          created_at: string | null
          error_message: string | null
          estimated_completion_time: string | null
          failed_tasks: number | null
          generation_config: Json | null
          id: string
          is_cleared: boolean
          job_data: Json | null
          job_type: string
          organisation_id: string
          performance_metrics: Json | null
          progress_percentage: number | null
          result_data: Json | null
          retry_configuration: Json | null
          skipped_tasks: number | null
          started_at: string | null
          status: string | null
          total_tasks: number | null
          updated_at: string | null
          user_actions: Json | null
          user_id: string | null
        }
        Insert: {
          actual_completion_time?: string | null
          base_class_id?: string | null
          completed_at?: string | null
          completed_tasks?: number | null
          confetti_shown?: boolean | null
          created_at?: string | null
          error_message?: string | null
          estimated_completion_time?: string | null
          failed_tasks?: number | null
          generation_config?: Json | null
          id?: string
          is_cleared?: boolean
          job_data?: Json | null
          job_type: string
          organisation_id: string
          performance_metrics?: Json | null
          progress_percentage?: number | null
          result_data?: Json | null
          retry_configuration?: Json | null
          skipped_tasks?: number | null
          started_at?: string | null
          status?: string | null
          total_tasks?: number | null
          updated_at?: string | null
          user_actions?: Json | null
          user_id?: string | null
        }
        Update: {
          actual_completion_time?: string | null
          base_class_id?: string | null
          completed_at?: string | null
          completed_tasks?: number | null
          confetti_shown?: boolean | null
          created_at?: string | null
          error_message?: string | null
          estimated_completion_time?: string | null
          failed_tasks?: number | null
          generation_config?: Json | null
          id?: string
          is_cleared?: boolean
          job_data?: Json | null
          job_type?: string
          organisation_id?: string
          performance_metrics?: Json | null
          progress_percentage?: number | null
          result_data?: Json | null
          retry_configuration?: Json | null
          skipped_tasks?: number | null
          started_at?: string | null
          status?: string | null
          total_tasks?: number | null
          updated_at?: string | null
          user_actions?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_generation_jobs_base_class_id_fkey"
            columns: ["base_class_id"]
            isOneToOne: false
            referencedRelation: "base_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      course_generation_tasks: {
        Row: {
          actual_duration_seconds: number | null
          base_class_id: string | null
          completed_at: string | null
          created_at: string | null
          current_retry_count: number | null
          dependencies: string[] | null
          error_category: string | null
          error_details: Json | null
          error_message: string | null
          error_severity:
            | Database["public"]["Enums"]["course_generation_error_severity"]
            | null
          estimated_duration_seconds: number | null
          execution_priority: number | null
          id: string
          input_data: Json | null
          is_recoverable: boolean | null
          job_id: string
          last_retry_at: string | null
          lesson_id: string | null
          max_retry_count: number | null
          output_data: Json | null
          path_id: string | null
          queued_at: string | null
          recovery_suggestions: string[] | null
          result_metadata: Json | null
          section_index: number | null
          section_title: string | null
          started_at: string | null
          status:
            | Database["public"]["Enums"]["course_generation_task_status"]
            | null
          task_identifier: string
          task_type: Database["public"]["Enums"]["course_generation_task_type"]
          updated_at: string | null
        }
        Insert: {
          actual_duration_seconds?: number | null
          base_class_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_retry_count?: number | null
          dependencies?: string[] | null
          error_category?: string | null
          error_details?: Json | null
          error_message?: string | null
          error_severity?:
            | Database["public"]["Enums"]["course_generation_error_severity"]
            | null
          estimated_duration_seconds?: number | null
          execution_priority?: number | null
          id?: string
          input_data?: Json | null
          is_recoverable?: boolean | null
          job_id: string
          last_retry_at?: string | null
          lesson_id?: string | null
          max_retry_count?: number | null
          output_data?: Json | null
          path_id?: string | null
          queued_at?: string | null
          recovery_suggestions?: string[] | null
          result_metadata?: Json | null
          section_index?: number | null
          section_title?: string | null
          started_at?: string | null
          status?:
            | Database["public"]["Enums"]["course_generation_task_status"]
            | null
          task_identifier: string
          task_type: Database["public"]["Enums"]["course_generation_task_type"]
          updated_at?: string | null
        }
        Update: {
          actual_duration_seconds?: number | null
          base_class_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_retry_count?: number | null
          dependencies?: string[] | null
          error_category?: string | null
          error_details?: Json | null
          error_message?: string | null
          error_severity?:
            | Database["public"]["Enums"]["course_generation_error_severity"]
            | null
          estimated_duration_seconds?: number | null
          execution_priority?: number | null
          id?: string
          input_data?: Json | null
          is_recoverable?: boolean | null
          job_id?: string
          last_retry_at?: string | null
          lesson_id?: string | null
          max_retry_count?: number | null
          output_data?: Json | null
          path_id?: string | null
          queued_at?: string | null
          recovery_suggestions?: string[] | null
          result_metadata?: Json | null
          section_index?: number | null
          section_title?: string | null
          started_at?: string | null
          status?:
            | Database["public"]["Enums"]["course_generation_task_status"]
            | null
          task_identifier?: string
          task_type?: Database["public"]["Enums"]["course_generation_task_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_generation_tasks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "course_generation_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      course_generation_user_actions: {
        Row: {
          action_context: Json | null
          action_result: Json | null
          action_successful: boolean | null
          action_type: string
          affected_tasks: string[] | null
          created_at: string | null
          id: string
          job_id: string
          user_id: string
        }
        Insert: {
          action_context?: Json | null
          action_result?: Json | null
          action_successful?: boolean | null
          action_type: string
          affected_tasks?: string[] | null
          created_at?: string | null
          id?: string
          job_id: string
          user_id: string
        }
        Update: {
          action_context?: Json | null
          action_result?: Json | null
          action_successful?: boolean | null
          action_type?: string
          affected_tasks?: string[] | null
          created_at?: string | null
          id?: string
          job_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_generation_user_actions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "course_generation_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      family_students: {
        Row: {
          created_at: string | null
          created_by: string | null
          family_id: string
          id: string
          student_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          family_id: string
          id?: string
          student_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          family_id?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_students_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "family_students_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "homeschool_family_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      feedback_records: {
        Row: {
          content: Json
          created_at: string | null
          created_by: string | null
          id: string
          organisation_id: string
          updated_at: string | null
        }
        Insert: {
          content: Json
          created_at?: string | null
          created_by?: string | null
          id?: string
          organisation_id: string
          updated_at?: string | null
        }
        Update: {
          content?: Json
          created_at?: string | null
          created_by?: string | null
          id?: string
          organisation_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "feedback_records_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_support: {
        Row: {
          assigned_to: string | null
          browser_info: Json | null
          category: string
          contact_email: string | null
          created_at: string
          current_page: string | null
          id: string
          message: string
          organisation_id: string | null
          priority: string
          resolved_at: string | null
          status: string
          subject: string
          updated_at: string
          user_agent: string | null
          user_id: string
          wants_followup: boolean | null
        }
        Insert: {
          assigned_to?: string | null
          browser_info?: Json | null
          category: string
          contact_email?: string | null
          created_at?: string
          current_page?: string | null
          id?: string
          message: string
          organisation_id?: string | null
          priority?: string
          resolved_at?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
          wants_followup?: boolean | null
        }
        Update: {
          assigned_to?: string | null
          browser_info?: Json | null
          category?: string
          contact_email?: string | null
          created_at?: string
          current_page?: string | null
          id?: string
          message?: string
          organisation_id?: string | null
          priority?: string
          resolved_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
          wants_followup?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_support_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_templates: {
        Row: {
          base_class_id: string | null
          cognitive_levels: string[] | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          question_types: string[] | null
          template_text: string
          template_type: string | null
          updated_at: string
          variables: Json | null
        }
        Insert: {
          base_class_id?: string | null
          cognitive_levels?: string[] | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          question_types?: string[] | null
          template_text: string
          template_type?: string | null
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          base_class_id?: string | null
          cognitive_levels?: string[] | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          question_types?: string[] | null
          template_text?: string
          template_type?: string | null
          updated_at?: string
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_templates_base_class_id_fkey"
            columns: ["base_class_id"]
            isOneToOne: false
            referencedRelation: "base_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcard_sets: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_shared: boolean | null
          linked_lesson_id: string | null
          linked_path_id: string | null
          name: string
          organisation_id: string
          settings: Json | null
          study_space_id: string
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_shared?: boolean | null
          linked_lesson_id?: string | null
          linked_path_id?: string | null
          name: string
          organisation_id: string
          settings?: Json | null
          study_space_id: string
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_shared?: boolean | null
          linked_lesson_id?: string | null
          linked_path_id?: string | null
          name?: string
          organisation_id?: string
          settings?: Json | null
          study_space_id?: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_sets_linked_lesson_id_fkey"
            columns: ["linked_lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcard_sets_linked_path_id_fkey"
            columns: ["linked_path_id"]
            isOneToOne: false
            referencedRelation: "paths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcard_sets_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcard_sets_study_space_id_fkey"
            columns: ["study_space_id"]
            isOneToOne: false
            referencedRelation: "study_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcards: {
        Row: {
          back_content: Json
          created_at: string
          difficulty_rating: number | null
          ease_factor: number | null
          flashcard_set_id: string
          front_content: Json
          hint_content: Json | null
          id: string
          interval_days: number | null
          is_starred: boolean | null
          last_reviewed_at: string | null
          next_review_date: string | null
          organisation_id: string
          repetition_count: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          back_content?: Json
          created_at?: string
          difficulty_rating?: number | null
          ease_factor?: number | null
          flashcard_set_id: string
          front_content?: Json
          hint_content?: Json | null
          id?: string
          interval_days?: number | null
          is_starred?: boolean | null
          last_reviewed_at?: string | null
          next_review_date?: string | null
          organisation_id: string
          repetition_count?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          back_content?: Json
          created_at?: string
          difficulty_rating?: number | null
          ease_factor?: number | null
          flashcard_set_id?: string
          front_content?: Json
          hint_content?: Json | null
          id?: string
          interval_days?: number | null
          is_starred?: boolean | null
          last_reviewed_at?: string | null
          next_review_date?: string | null
          organisation_id?: string
          repetition_count?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_flashcard_set_id_fkey"
            columns: ["flashcard_set_id"]
            isOneToOne: false
            referencedRelation: "flashcard_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcards_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_lesson_content: {
        Row: {
          content_type: string
          course_outline_id: string | null
          created_at: string | null
          generated_content: Json
          generation_metadata: Json | null
          id: string
          lesson_id: string | null
          organisation_id: string
          source_chunks: string[] | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          content_type: string
          course_outline_id?: string | null
          created_at?: string | null
          generated_content: Json
          generation_metadata?: Json | null
          id?: string
          lesson_id?: string | null
          organisation_id: string
          source_chunks?: string[] | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          content_type?: string
          course_outline_id?: string | null
          created_at?: string | null
          generated_content?: Json
          generation_metadata?: Json | null
          id?: string
          lesson_id?: string | null
          organisation_id?: string
          source_chunks?: string[] | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_lesson_content_course_outline_id_fkey"
            columns: ["course_outline_id"]
            isOneToOne: false
            referencedRelation: "course_outlines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_lesson_content_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_citations: {
        Row: {
          chunk_id: string
          context_position: number | null
          created_at: string
          generation_id: string
          id: string
          relevance_score: number | null
        }
        Insert: {
          chunk_id: string
          context_position?: number | null
          created_at?: string
          generation_id: string
          id?: string
          relevance_score?: number | null
        }
        Update: {
          chunk_id?: string
          context_position?: number | null
          created_at?: string
          generation_id?: string
          id?: string
          relevance_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "generation_citations_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: false
            referencedRelation: "document_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_citations_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
        ]
      }
      generations: {
        Row: {
          asset_id: string | null
          asset_type: string
          completion_tokens: number | null
          created_at: string
          error_message: string | null
          id: string
          model_used: string | null
          organisation_id: string
          prompt_tokens: number | null
          query: string | null
          response: string | null
          status: string
          total_tokens: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          asset_id?: string | null
          asset_type: string
          completion_tokens?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          model_used?: string | null
          organisation_id: string
          prompt_tokens?: number | null
          query?: string | null
          response?: string | null
          status?: string
          total_tokens?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          asset_id?: string | null
          asset_type?: string
          completion_tokens?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          model_used?: string | null
          organisation_id?: string
          prompt_tokens?: number | null
          query?: string | null
          response?: string | null
          status?: string
          total_tokens?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generations_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_appeals: {
        Row: {
          appeal_reason: string
          created_at: string | null
          final_score: number | null
          grading_record_id: string
          id: string
          original_score: number
          requested_score: number | null
          resolved_at: string | null
          reviewer_id: string | null
          reviewer_notes: string | null
          status: string | null
          student_id: string
          updated_at: string | null
        }
        Insert: {
          appeal_reason: string
          created_at?: string | null
          final_score?: number | null
          grading_record_id: string
          id?: string
          original_score: number
          requested_score?: number | null
          resolved_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: string | null
          student_id: string
          updated_at?: string | null
        }
        Update: {
          appeal_reason?: string
          created_at?: string | null
          final_score?: number | null
          grading_record_id?: string
          id?: string
          original_score?: number
          requested_score?: number | null
          resolved_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: string | null
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grade_appeals_grading_record_id_fkey"
            columns: ["grading_record_id"]
            isOneToOne: false
            referencedRelation: "grading_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_appeals_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "grade_appeals_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      gradebook_settings: {
        Row: {
          class_instance_id: string | null
          created_at: string
          id: string
          settings: Json
          updated_at: string
        }
        Insert: {
          class_instance_id?: string | null
          created_at?: string
          id?: string
          settings?: Json
          updated_at?: string
        }
        Update: {
          class_instance_id?: string | null
          created_at?: string
          id?: string
          settings?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gradebook_settings_class_instance_id_fkey"
            columns: ["class_instance_id"]
            isOneToOne: true
            referencedRelation: "class_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      grades: {
        Row: {
          assignment_id: string | null
          class_instance_id: string | null
          created_at: string
          feedback: string | null
          graded_at: string | null
          graded_by: string | null
          id: string
          percentage: number | null
          points_earned: number | null
          status: Database["public"]["Enums"]["grade_status"]
          student_id: string | null
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          assignment_id?: string | null
          class_instance_id?: string | null
          created_at?: string
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          percentage?: number | null
          points_earned?: number | null
          status?: Database["public"]["Enums"]["grade_status"]
          student_id?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          assignment_id?: string | null
          class_instance_id?: string | null
          created_at?: string
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          percentage?: number | null
          points_earned?: number | null
          status?: Database["public"]["Enums"]["grade_status"]
          student_id?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grades_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_class_instance_id_fkey"
            columns: ["class_instance_id"]
            isOneToOne: false
            referencedRelation: "class_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "grades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      grading_calibration: {
        Row: {
          actual_score: number
          calibration_round: number | null
          created_at: string | null
          deviation: number | null
          expected_score: number
          grader_id: string
          id: string
          notes: string | null
          rubric_id: string
          sample_response_id: string
        }
        Insert: {
          actual_score: number
          calibration_round?: number | null
          created_at?: string | null
          deviation?: number | null
          expected_score: number
          grader_id: string
          id?: string
          notes?: string | null
          rubric_id: string
          sample_response_id: string
        }
        Update: {
          actual_score?: number
          calibration_round?: number | null
          created_at?: string | null
          deviation?: number | null
          expected_score?: number
          grader_id?: string
          id?: string
          notes?: string | null
          rubric_id?: string
          sample_response_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grading_calibration_grader_id_fkey"
            columns: ["grader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "grading_calibration_rubric_id_fkey"
            columns: ["rubric_id"]
            isOneToOne: false
            referencedRelation: "rubrics"
            referencedColumns: ["id"]
          },
        ]
      }
      grading_records: {
        Row: {
          confidence_score: number | null
          created_at: string | null
          criterion_id: string | null
          feedback: string | null
          flags: string[] | null
          id: string
          max_points: number
          metadata: Json | null
          performance_level: string | null
          points_awarded: number
          response_id: string
          response_type: string
          session_id: string
          time_spent_seconds: number | null
          updated_at: string | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string | null
          criterion_id?: string | null
          feedback?: string | null
          flags?: string[] | null
          id?: string
          max_points: number
          metadata?: Json | null
          performance_level?: string | null
          points_awarded: number
          response_id: string
          response_type: string
          session_id: string
          time_spent_seconds?: number | null
          updated_at?: string | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string | null
          criterion_id?: string | null
          feedback?: string | null
          flags?: string[] | null
          id?: string
          max_points?: number
          metadata?: Json | null
          performance_level?: string | null
          points_awarded?: number
          response_id?: string
          response_type?: string
          session_id?: string
          time_spent_seconds?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grading_records_criterion_id_fkey"
            columns: ["criterion_id"]
            isOneToOne: false
            referencedRelation: "rubric_criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grading_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "grading_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      grading_sessions: {
        Row: {
          assessment_id: string
          assessment_type: Database["public"]["Enums"]["assessment_type"]
          calibration_score: number | null
          completed_at: string | null
          created_at: string | null
          graded_responses: number | null
          grader_id: string
          grading_method: Database["public"]["Enums"]["grading_method"]
          id: string
          metadata: Json | null
          rubric_id: string | null
          started_at: string | null
          total_responses: number | null
          updated_at: string | null
        }
        Insert: {
          assessment_id: string
          assessment_type: Database["public"]["Enums"]["assessment_type"]
          calibration_score?: number | null
          completed_at?: string | null
          created_at?: string | null
          graded_responses?: number | null
          grader_id: string
          grading_method: Database["public"]["Enums"]["grading_method"]
          id?: string
          metadata?: Json | null
          rubric_id?: string | null
          started_at?: string | null
          total_responses?: number | null
          updated_at?: string | null
        }
        Update: {
          assessment_id?: string
          assessment_type?: Database["public"]["Enums"]["assessment_type"]
          calibration_score?: number | null
          completed_at?: string | null
          created_at?: string | null
          graded_responses?: number | null
          grader_id?: string
          grading_method?: Database["public"]["Enums"]["grading_method"]
          id?: string
          metadata?: Json | null
          rubric_id?: string | null
          started_at?: string | null
          total_responses?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grading_sessions_grader_id_fkey"
            columns: ["grader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "grading_sessions_rubric_id_fkey"
            columns: ["rubric_id"]
            isOneToOne: false
            referencedRelation: "rubrics"
            referencedColumns: ["id"]
          },
        ]
      }
      homeschool_family_info: {
        Row: {
          created_at: string
          family_name: string
          id: string
          organisation_id: string
          organisation_unit_id: string
          primary_parent_id: string | null
          settings: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          family_name: string
          id?: string
          organisation_id: string
          organisation_unit_id: string
          primary_parent_id?: string | null
          settings?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          family_name?: string
          id?: string
          organisation_id?: string
          organisation_unit_id?: string
          primary_parent_id?: string | null
          settings?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "homeschool_family_info_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homeschool_family_info_organisation_unit_id_fkey"
            columns: ["organisation_unit_id"]
            isOneToOne: false
            referencedRelation: "organisation_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homeschool_family_info_primary_parent_id_fkey"
            columns: ["primary_parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      invite_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          organisation_id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          organisation_id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          organisation_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invite_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_codes_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base_analyses: {
        Row: {
          analysis_details: Json | null
          base_class_id: string | null
          content_depth: string | null
          created_at: string | null
          id: string
          organisation_id: string
          recommended_generation_mode: string | null
          subject_coverage: string[] | null
          total_chunks: number | null
          total_documents: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          analysis_details?: Json | null
          base_class_id?: string | null
          content_depth?: string | null
          created_at?: string | null
          id?: string
          organisation_id: string
          recommended_generation_mode?: string | null
          subject_coverage?: string[] | null
          total_chunks?: number | null
          total_documents?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          analysis_details?: Json | null
          base_class_id?: string | null
          content_depth?: string | null
          created_at?: string | null
          id?: string
          organisation_id?: string
          recommended_generation_mode?: string | null
          subject_coverage?: string[] | null
          total_chunks?: number | null
          total_documents?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_analyses_base_class_id_fkey"
            columns: ["base_class_id"]
            isOneToOne: false
            referencedRelation: "base_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_media_assets: {
        Row: {
          asset_type: string
          content: Json | null
          created_at: string | null
          created_by: string | null
          duration: number | null
          file_path: string | null
          file_url: string | null
          id: string
          lesson_id: string
          status: string
          svg_content: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          asset_type: string
          content?: Json | null
          created_at?: string | null
          created_by?: string | null
          duration?: number | null
          file_path?: string | null
          file_url?: string | null
          id?: string
          lesson_id: string
          status?: string
          svg_content?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          asset_type?: string
          content?: Json | null
          created_at?: string | null
          created_by?: string | null
          duration?: number | null
          file_path?: string | null
          file_url?: string | null
          id?: string
          lesson_id?: string
          status?: string
          svg_content?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_media_assets_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_section_versions: {
        Row: {
          content: Json | null
          created_at: string
          creator_user_id: string | null
          id: string
          lesson_section_id: string
          version_number: number
        }
        Insert: {
          content?: Json | null
          created_at?: string
          creator_user_id?: string | null
          id?: string
          lesson_section_id: string
          version_number: number
        }
        Update: {
          content?: Json | null
          created_at?: string
          creator_user_id?: string | null
          id?: string
          lesson_section_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "lesson_section_versions_lesson_section_id_fkey"
            columns: ["lesson_section_id"]
            isOneToOne: false
            referencedRelation: "lesson_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_sections: {
        Row: {
          content: Json | null
          content_embedding: string | null
          created_at: string
          created_by: string | null
          id: string
          lesson_id: string
          media_url: string | null
          order_index: number
          section_type: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: Json | null
          content_embedding?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lesson_id: string
          media_url?: string | null
          order_index: number
          section_type: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: Json | null
          content_embedding?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lesson_id?: string
          media_url?: string | null
          order_index?: number
          section_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_sections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "lesson_sections_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          banner_image: string | null
          base_class_id: string | null
          created_at: string
          created_by: string | null
          creator_user_id: string | null
          description: string | null
          estimated_time: number | null
          id: string
          level: string | null
          order_index: number
          path_id: string
          published: boolean | null
          teaching_outline_content: string | null
          teaching_outline_generated_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          banner_image?: string | null
          base_class_id?: string | null
          created_at?: string
          created_by?: string | null
          creator_user_id?: string | null
          description?: string | null
          estimated_time?: number | null
          id?: string
          level?: string | null
          order_index: number
          path_id: string
          published?: boolean | null
          teaching_outline_content?: string | null
          teaching_outline_generated_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          banner_image?: string | null
          base_class_id?: string | null
          created_at?: string
          created_by?: string | null
          creator_user_id?: string | null
          description?: string | null
          estimated_time?: number | null
          id?: string
          level?: string | null
          order_index?: number
          path_id?: string
          published?: boolean | null
          teaching_outline_content?: string | null
          teaching_outline_generated_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_base_class_id_fkey"
            columns: ["base_class_id"]
            isOneToOne: false
            referencedRelation: "base_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "lessons_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "paths"
            referencedColumns: ["id"]
          },
        ]
      }
      luna_conversations: {
        Row: {
          created_at: string | null
          id: string
          is_archived: boolean | null
          is_pinned: boolean | null
          message_count: number | null
          metadata: Json | null
          persona: string
          summary: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          is_pinned?: boolean | null
          message_count?: number | null
          metadata?: Json | null
          persona?: string
          summary?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          is_pinned?: boolean | null
          message_count?: number | null
          metadata?: Json | null
          persona?: string
          summary?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      luna_messages: {
        Row: {
          action_buttons: Json | null
          citations: Json | null
          content: string
          conversation_id: string
          created_at: string | null
          edit_history: Json | null
          id: string
          is_outline: boolean | null
          metadata: Json | null
          outline_data: Json | null
          parent_message_id: string | null
          persona: string
          role: string
          updated_at: string | null
        }
        Insert: {
          action_buttons?: Json | null
          citations?: Json | null
          content: string
          conversation_id: string
          created_at?: string | null
          edit_history?: Json | null
          id?: string
          is_outline?: boolean | null
          metadata?: Json | null
          outline_data?: Json | null
          parent_message_id?: string | null
          persona?: string
          role: string
          updated_at?: string | null
        }
        Update: {
          action_buttons?: Json | null
          citations?: Json | null
          content?: string
          conversation_id?: string
          created_at?: string | null
          edit_history?: Json | null
          id?: string
          is_outline?: boolean | null
          metadata?: Json | null
          outline_data?: Json | null
          parent_message_id?: string | null
          persona?: string
          role?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "luna_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "luna_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "luna_messages_parent_message_id_fkey"
            columns: ["parent_message_id"]
            isOneToOne: false
            referencedRelation: "luna_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          created_at: string
          email: string | null
          first_name: string | null
          grade_level: string | null
          id: string
          last_name: string | null
          organisation_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          settings: Json | null
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          grade_level?: string | null
          id: string
          last_name?: string | null
          organisation_id?: string | null
          role: Database["public"]["Enums"]["user_role"]
          settings?: Json | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          grade_level?: string | null
          id?: string
          last_name?: string | null
          organisation_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          settings?: Json | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      mind_maps: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_shared: boolean | null
          is_template: boolean | null
          linked_lesson_id: string | null
          linked_path_id: string | null
          map_data: Json
          organisation_id: string
          study_space_id: string
          svg_content: string | null
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_shared?: boolean | null
          is_template?: boolean | null
          linked_lesson_id?: string | null
          linked_path_id?: string | null
          map_data?: Json
          organisation_id: string
          study_space_id: string
          svg_content?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_shared?: boolean | null
          is_template?: boolean | null
          linked_lesson_id?: string | null
          linked_path_id?: string | null
          map_data?: Json
          organisation_id?: string
          study_space_id?: string
          svg_content?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mind_maps_linked_lesson_id_fkey"
            columns: ["linked_lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mind_maps_linked_path_id_fkey"
            columns: ["linked_path_id"]
            isOneToOne: false
            referencedRelation: "paths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mind_maps_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mind_maps_study_space_id_fkey"
            columns: ["study_space_id"]
            isOneToOne: false
            referencedRelation: "study_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_units: {
        Row: {
          created_at: string
          id: string
          name: string
          organisation_id: string | null
          settings: Json | null
          unit_type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organisation_id?: string | null
          settings?: Json | null
          unit_type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organisation_id?: string | null
          settings?: Json | null
          unit_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisation_units_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          abbr: string | null
          abbreviation: string | null
          created_at: string
          id: string
          max_students: number | null
          name: string
          organisation_type: string | null
          settings: Json | null
          subscription_expires_at: string | null
          subscription_started_at: string | null
          subscription_status: string | null
          updated_at: string
        }
        Insert: {
          abbr?: string | null
          abbreviation?: string | null
          created_at?: string
          id?: string
          max_students?: number | null
          name: string
          organisation_type?: string | null
          settings?: Json | null
          subscription_expires_at?: string | null
          subscription_started_at?: string | null
          subscription_status?: string | null
          updated_at?: string
        }
        Update: {
          abbr?: string | null
          abbreviation?: string | null
          created_at?: string
          id?: string
          max_students?: number | null
          name?: string
          organisation_type?: string | null
          settings?: Json | null
          subscription_expires_at?: string | null
          subscription_started_at?: string | null
          subscription_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      password_reset_requests: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          fulfilled_at: string | null
          id: string
          reset_token: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          fulfilled_at?: string | null
          id?: string
          reset_token: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          fulfilled_at?: string | null
          id?: string
          reset_token?: string
        }
        Relationships: []
      }
      paths: {
        Row: {
          banner_image: string | null
          base_class_id: string | null
          created_at: string
          created_by: string | null
          creator_user_id: string | null
          description: string | null
          id: string
          level: string | null
          order_index: number | null
          organisation_id: string
          published: boolean | null
          title: string
          updated_at: string
        }
        Insert: {
          banner_image?: string | null
          base_class_id?: string | null
          created_at?: string
          created_by?: string | null
          creator_user_id?: string | null
          description?: string | null
          id?: string
          level?: string | null
          order_index?: number | null
          organisation_id: string
          published?: boolean | null
          title: string
          updated_at?: string
        }
        Update: {
          banner_image?: string | null
          base_class_id?: string | null
          created_at?: string
          created_by?: string | null
          creator_user_id?: string | null
          description?: string | null
          id?: string
          level?: string | null
          order_index?: number | null
          organisation_id?: string
          published?: boolean | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paths_base_class_id_fkey"
            columns: ["base_class_id"]
            isOneToOne: false
            referencedRelation: "base_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paths_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "paths_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      process_analytics: {
        Row: {
          assessment_session_id: string
          client_timestamp: string | null
          element_id: string | null
          element_type: string | null
          event_data: Json | null
          event_type: string
          id: string
          question_id: string | null
          timestamp: string
          x_coordinate: number | null
          y_coordinate: number | null
        }
        Insert: {
          assessment_session_id: string
          client_timestamp?: string | null
          element_id?: string | null
          element_type?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          question_id?: string | null
          timestamp?: string
          x_coordinate?: number | null
          y_coordinate?: number | null
        }
        Update: {
          assessment_session_id?: string
          client_timestamp?: string | null
          element_id?: string | null
          element_type?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          question_id?: string | null
          timestamp?: string
          x_coordinate?: number | null
          y_coordinate?: number | null
        }
        Relationships: []
      }
      proctoring_events: {
        Row: {
          action_taken: string | null
          assessment_session_id: string
          auto_detected: boolean | null
          description: string | null
          event_data: Json | null
          event_type: string
          id: string
          reviewed: boolean | null
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string | null
          timestamp: string
        }
        Insert: {
          action_taken?: string | null
          assessment_session_id: string
          auto_detected?: boolean | null
          description?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          reviewed?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string | null
          timestamp?: string
        }
        Update: {
          action_taken?: string | null
          assessment_session_id?: string
          auto_detected?: boolean | null
          description?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          reviewed?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "proctoring_events_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_role: Database["public"]["Enums"]["role"] | null
          additional_roles: Json | null
          created_at: string
          family_id: string | null
          first_name: string | null
          grade_level: string | null
          is_canceled: boolean | null
          is_primary_parent: boolean | null
          is_sub_account: boolean | null
          last_name: string | null
          onboarding_completed: boolean | null
          onboarding_step: string | null
          organisation_id: string | null
          organisation_unit_id: string | null
          paid: boolean | null
          paid_at: string | null
          parent_account_id: string | null
          payment_amount_cents: number | null
          payment_currency: string | null
          role: Database["public"]["Enums"]["role"]
          settings: Json | null
          stripe_customer_id: string | null
          stripe_payment_intent_id: string | null
          stripe_receipt_url: string | null
          stripe_subscription_id: string | null
          subscription_cancel_at_period_end: boolean | null
          subscription_current_period_end: string | null
          subscription_status: string | null
          survey_completed: boolean | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          active_role?: Database["public"]["Enums"]["role"] | null
          additional_roles?: Json | null
          created_at?: string
          family_id?: string | null
          first_name?: string | null
          grade_level?: string | null
          is_canceled?: boolean | null
          is_primary_parent?: boolean | null
          is_sub_account?: boolean | null
          last_name?: string | null
          onboarding_completed?: boolean | null
          onboarding_step?: string | null
          organisation_id?: string | null
          organisation_unit_id?: string | null
          paid?: boolean | null
          paid_at?: string | null
          parent_account_id?: string | null
          payment_amount_cents?: number | null
          payment_currency?: string | null
          role: Database["public"]["Enums"]["role"]
          settings?: Json | null
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_receipt_url?: string | null
          stripe_subscription_id?: string | null
          subscription_cancel_at_period_end?: boolean | null
          subscription_current_period_end?: string | null
          subscription_status?: string | null
          survey_completed?: boolean | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          active_role?: Database["public"]["Enums"]["role"] | null
          additional_roles?: Json | null
          created_at?: string
          family_id?: string | null
          first_name?: string | null
          grade_level?: string | null
          is_canceled?: boolean | null
          is_primary_parent?: boolean | null
          is_sub_account?: boolean | null
          last_name?: string | null
          onboarding_completed?: boolean | null
          onboarding_step?: string | null
          organisation_id?: string | null
          organisation_unit_id?: string | null
          paid?: boolean | null
          paid_at?: string | null
          parent_account_id?: string | null
          payment_amount_cents?: number | null
          payment_currency?: string | null
          role?: Database["public"]["Enums"]["role"]
          settings?: Json | null
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_receipt_url?: string | null
          stripe_subscription_id?: string | null
          subscription_cancel_at_period_end?: boolean | null
          subscription_current_period_end?: string | null
          subscription_status?: string | null
          survey_completed?: boolean | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "homeschool_family_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_organisation_unit_id_fkey"
            columns: ["organisation_unit_id"]
            isOneToOne: false
            referencedRelation: "organisation_units"
            referencedColumns: ["id"]
          },
        ]
      }
      progress: {
        Row: {
          created_at: string
          id: string
          item_id: string
          item_type: string
          last_position: string | null
          progress_percentage: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          item_type: string
          last_position?: string | null
          progress_percentage?: number | null
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          item_type?: string
          last_position?: string | null
          progress_percentage?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      public_survey_question_responses: {
        Row: {
          created_at: string | null
          id: number
          question_id: number | null
          response_text: string | null
          response_value: string | null
          survey_response_id: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          question_id?: number | null
          response_text?: string | null
          response_value?: string | null
          survey_response_id?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          question_id?: number | null
          response_text?: string | null
          response_value?: string | null
          survey_response_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_survey_question_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "public_survey_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_survey_question_responses_survey_response_id_fkey"
            columns: ["survey_response_id"]
            isOneToOne: false
            referencedRelation: "public_survey_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      public_survey_questions: {
        Row: {
          created_at: string | null
          id: number
          options: Json | null
          order_index: number
          question_text: string
          question_type: string
          required: boolean | null
          section_id: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          options?: Json | null
          order_index: number
          question_text: string
          question_type: string
          required?: boolean | null
          section_id?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          options?: Json | null
          order_index?: number
          question_text?: string
          question_type?: string
          required?: boolean | null
          section_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_survey_questions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "public_survey_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      public_survey_responses: {
        Row: {
          completed_at: string | null
          created_at: string | null
          device_info: Json | null
          duration_seconds: number | null
          email: string | null
          id: number
          ip_address: unknown
          session_id: string | null
          updated_at: string | null
          user_agent: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          device_info?: Json | null
          duration_seconds?: number | null
          email?: string | null
          id?: number
          ip_address?: unknown
          session_id?: string | null
          updated_at?: string | null
          user_agent?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          device_info?: Json | null
          duration_seconds?: number | null
          email?: string | null
          id?: number
          ip_address?: unknown
          session_id?: string | null
          updated_at?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      public_survey_sections: {
        Row: {
          created_at: string | null
          description: string | null
          id: number
          order_index: number
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: number
          order_index: number
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: number
          order_index?: number
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      rosters: {
        Row: {
          class_instance_id: string
          created_at: string
          id: string
          joined_at: string
          profile_id: string
          role: Database["public"]["Enums"]["user_role"]
          settings: Json | null
          updated_at: string
        }
        Insert: {
          class_instance_id: string
          created_at?: string
          id?: string
          joined_at?: string
          profile_id: string
          role: Database["public"]["Enums"]["user_role"]
          settings?: Json | null
          updated_at?: string
        }
        Update: {
          class_instance_id?: string
          created_at?: string
          id?: string
          joined_at?: string
          profile_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          settings?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rosters_class_instance_id_fkey"
            columns: ["class_instance_id"]
            isOneToOne: false
            referencedRelation: "class_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rosters_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      rubric_criteria: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          max_points: number
          name: string
          order_index: number | null
          performance_levels: Json
          rubric_id: string
          updated_at: string | null
          weight: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          max_points?: number
          name: string
          order_index?: number | null
          performance_levels: Json
          rubric_id: string
          updated_at?: string | null
          weight?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          max_points?: number
          name?: string
          order_index?: number | null
          performance_levels?: Json
          rubric_id?: string
          updated_at?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rubric_criteria_rubric_id_fkey"
            columns: ["rubric_id"]
            isOneToOne: false
            referencedRelation: "rubrics"
            referencedColumns: ["id"]
          },
        ]
      }
      rubrics: {
        Row: {
          base_class_id: string | null
          created_at: string
          created_by: string | null
          criteria: Json
          description: string | null
          grading_scale:
            | Database["public"]["Enums"]["grading_scale_type"]
            | null
          id: string
          is_template: boolean | null
          name: string
          parent_rubric_id: string | null
          rubric_type: Database["public"]["Enums"]["criterion_type"] | null
          scale_definition: Json | null
          tags: string[] | null
          total_points: number
          updated_at: string
          version: number | null
        }
        Insert: {
          base_class_id?: string | null
          created_at?: string
          created_by?: string | null
          criteria?: Json
          description?: string | null
          grading_scale?:
            | Database["public"]["Enums"]["grading_scale_type"]
            | null
          id?: string
          is_template?: boolean | null
          name: string
          parent_rubric_id?: string | null
          rubric_type?: Database["public"]["Enums"]["criterion_type"] | null
          scale_definition?: Json | null
          tags?: string[] | null
          total_points?: number
          updated_at?: string
          version?: number | null
        }
        Update: {
          base_class_id?: string | null
          created_at?: string
          created_by?: string | null
          criteria?: Json
          description?: string | null
          grading_scale?:
            | Database["public"]["Enums"]["grading_scale_type"]
            | null
          id?: string
          is_template?: boolean | null
          name?: string
          parent_rubric_id?: string | null
          rubric_type?: Database["public"]["Enums"]["criterion_type"] | null
          scale_definition?: Json | null
          tags?: string[] | null
          total_points?: number
          updated_at?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rubrics_base_class_id_fkey"
            columns: ["base_class_id"]
            isOneToOne: false
            referencedRelation: "base_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rubrics_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rubrics_parent_rubric_id_fkey"
            columns: ["parent_rubric_id"]
            isOneToOne: false
            referencedRelation: "rubrics"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_states: {
        Row: {
          assessment_session_id: string
          completion_percentage: number | null
          created_at: string
          current_state: Json
          id: string
          previous_states: Json | null
          simulation_data: Json | null
          simulation_type: string
          updated_at: string
          user_actions: Json | null
        }
        Insert: {
          assessment_session_id: string
          completion_percentage?: number | null
          created_at?: string
          current_state?: Json
          id?: string
          previous_states?: Json | null
          simulation_data?: Json | null
          simulation_type: string
          updated_at?: string
          user_actions?: Json | null
        }
        Update: {
          assessment_session_id?: string
          completion_percentage?: number | null
          created_at?: string
          current_state?: Json
          id?: string
          previous_states?: Json | null
          simulation_data?: Json | null
          simulation_type?: string
          updated_at?: string
          user_actions?: Json | null
        }
        Relationships: []
      }
      standards: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          organisation_id: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          organisation_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          organisation_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "standards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "standards_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      student_attempts: {
        Row: {
          ai_feedback: string | null
          ai_graded_at: string | null
          ai_grading_status: string | null
          assessment_id: string
          attempt_number: number
          created_at: string | null
          earned_points: number | null
          id: string
          instructor_feedback: string | null
          manual_review_required: boolean | null
          manually_graded_at: string | null
          manually_graded_by: string | null
          passed: boolean | null
          percentage_score: number | null
          started_at: string | null
          status: string
          student_id: string
          submitted_at: string | null
          time_spent_minutes: number | null
          total_points: number | null
          updated_at: string | null
        }
        Insert: {
          ai_feedback?: string | null
          ai_graded_at?: string | null
          ai_grading_status?: string | null
          assessment_id: string
          attempt_number: number
          created_at?: string | null
          earned_points?: number | null
          id?: string
          instructor_feedback?: string | null
          manual_review_required?: boolean | null
          manually_graded_at?: string | null
          manually_graded_by?: string | null
          passed?: boolean | null
          percentage_score?: number | null
          started_at?: string | null
          status?: string
          student_id: string
          submitted_at?: string | null
          time_spent_minutes?: number | null
          total_points?: number | null
          updated_at?: string | null
        }
        Update: {
          ai_feedback?: string | null
          ai_graded_at?: string | null
          ai_grading_status?: string | null
          assessment_id?: string
          attempt_number?: number
          created_at?: string | null
          earned_points?: number | null
          id?: string
          instructor_feedback?: string | null
          manual_review_required?: boolean | null
          manually_graded_at?: string | null
          manually_graded_by?: string | null
          passed?: boolean | null
          percentage_score?: number | null
          started_at?: string | null
          status?: string
          student_id?: string
          submitted_at?: string | null
          time_spent_minutes?: number | null
          total_points?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_attempts_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_attempts_manually_graded_by_fkey"
            columns: ["manually_graded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "student_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      student_responses: {
        Row: {
          ai_confidence: number | null
          ai_feedback: string | null
          ai_graded_at: string | null
          ai_score: number | null
          attempt_id: string
          created_at: string | null
          final_feedback: string | null
          final_score: number | null
          id: string
          is_correct: boolean | null
          manual_feedback: string | null
          manual_score: number | null
          manually_graded_at: string | null
          manually_graded_by: string | null
          override_reason: string | null
          points_earned: number | null
          question_id: string
          response_data: Json
          updated_at: string | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_feedback?: string | null
          ai_graded_at?: string | null
          ai_score?: number | null
          attempt_id: string
          created_at?: string | null
          final_feedback?: string | null
          final_score?: number | null
          id?: string
          is_correct?: boolean | null
          manual_feedback?: string | null
          manual_score?: number | null
          manually_graded_at?: string | null
          manually_graded_by?: string | null
          override_reason?: string | null
          points_earned?: number | null
          question_id: string
          response_data: Json
          updated_at?: string | null
        }
        Update: {
          ai_confidence?: number | null
          ai_feedback?: string | null
          ai_graded_at?: string | null
          ai_score?: number | null
          attempt_id?: string
          created_at?: string | null
          final_feedback?: string | null
          final_score?: number | null
          id?: string
          is_correct?: boolean | null
          manual_feedback?: string | null
          manual_score?: number | null
          manually_graded_at?: string | null
          manually_graded_by?: string | null
          override_reason?: string | null
          points_earned?: number | null
          question_id?: string
          response_data?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_responses_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "student_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_responses_manually_graded_by_fkey"
            columns: ["manually_graded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "student_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "assessment_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      study_content_index: {
        Row: {
          assessment_ids: string[] | null
          base_class_id: string
          content_embedding: string | null
          content_json: Json | null
          content_text: string
          content_tsvector: unknown | null
          content_type: string
          created_at: string
          description: string | null
          difficulty_level: string | null
          estimated_time: number | null
          id: string
          indexed_at: string
          is_bookmarkable: boolean | null
          is_notable: boolean | null
          learning_objectives: string[] | null
          lesson_id: string | null
          media_asset_ids: string[] | null
          organisation_id: string
          parent_content_id: string | null
          path_id: string | null
          prerequisites: string[] | null
          progress_trackable: boolean | null
          related_content_ids: string[] | null
          search_keywords: string[] | null
          source_id: string
          source_table: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          assessment_ids?: string[] | null
          base_class_id: string
          content_embedding?: string | null
          content_json?: Json | null
          content_text: string
          content_tsvector?: unknown | null
          content_type: string
          created_at: string
          description?: string | null
          difficulty_level?: string | null
          estimated_time?: number | null
          id?: string
          indexed_at?: string
          is_bookmarkable?: boolean | null
          is_notable?: boolean | null
          learning_objectives?: string[] | null
          lesson_id?: string | null
          media_asset_ids?: string[] | null
          organisation_id: string
          parent_content_id?: string | null
          path_id?: string | null
          prerequisites?: string[] | null
          progress_trackable?: boolean | null
          related_content_ids?: string[] | null
          search_keywords?: string[] | null
          source_id: string
          source_table: string
          tags?: string[] | null
          title: string
          updated_at: string
        }
        Update: {
          assessment_ids?: string[] | null
          base_class_id?: string
          content_embedding?: string | null
          content_json?: Json | null
          content_text?: string
          content_tsvector?: unknown | null
          content_type?: string
          created_at?: string
          description?: string | null
          difficulty_level?: string | null
          estimated_time?: number | null
          id?: string
          indexed_at?: string
          is_bookmarkable?: boolean | null
          is_notable?: boolean | null
          learning_objectives?: string[] | null
          lesson_id?: string | null
          media_asset_ids?: string[] | null
          organisation_id?: string
          parent_content_id?: string | null
          path_id?: string | null
          prerequisites?: string[] | null
          progress_trackable?: boolean | null
          related_content_ids?: string[] | null
          search_keywords?: string[] | null
          source_id?: string
          source_table?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      study_space_brainbytes: {
        Row: {
          audio_url: string
          base_class_id: string | null
          content_context: string | null
          created_at: string | null
          duration_minutes: number | null
          id: string
          instructions: string | null
          script: string
          status: string | null
          study_space_id: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          audio_url: string
          base_class_id?: string | null
          content_context?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          instructions?: string | null
          script: string
          status?: string | null
          study_space_id?: string | null
          title?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          audio_url?: string
          base_class_id?: string | null
          content_context?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          instructions?: string | null
          script?: string
          status?: string | null
          study_space_id?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_space_brainbytes_base_class_id_fkey"
            columns: ["base_class_id"]
            isOneToOne: false
            referencedRelation: "base_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_space_brainbytes_study_space_id_fkey"
            columns: ["study_space_id"]
            isOneToOne: false
            referencedRelation: "study_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      [key: string]: {
        Row: Record<string, any>
        Insert: Record<string, any>
        Update: Record<string, any>
        Relationships: any[]
      }
    }
    Views: {
      [key: string]: {
        Row: Record<string, any>
        Insert: Record<string, any>
        Update: Record<string, any>
        Relationships: any[]
      }
    }
    Functions: {
      [key: string]: any
    }
    Enums: {
      course_generation_error_severity: "low" | "medium" | "high" | "critical"
      course_generation_task_status:
        | "pending"
        | "queued"
        | "running"
        | "completed"
        | "failed"
        | "skipped"
        | "retrying"
        | "cancelled"
      course_generation_task_type:
        | "lesson_section"
        | "lesson_assessment"
        | "lesson_mind_map"
        | "lesson_brainbytes"
        | "path_quiz"
        | "class_exam"
        | "knowledge_analysis"
        | "outline_generation"
        | "content_validation"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never 