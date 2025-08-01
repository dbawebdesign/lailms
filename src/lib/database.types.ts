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