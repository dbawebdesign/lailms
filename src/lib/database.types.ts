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
      ai_insights: {
        Row: {
          dismissed_at: string | null
          expires_at: string | null
          generated_at: string | null
          generation_prompt_version: number | null
          id: string
          insights: Json
          is_dismissed: boolean | null
          source_data_hash: string | null
          user_id: string
          user_role: Database["public"]["Enums"]["role"]
        }
        Insert: {
          dismissed_at?: string | null
          expires_at?: string | null
          generated_at?: string | null
          generation_prompt_version?: number | null
          id?: string
          insights: Json
          is_dismissed?: boolean | null
          source_data_hash?: string | null
          user_id: string
          user_role: Database["public"]["Enums"]["role"]
        }
        Update: {
          dismissed_at?: string | null
          expires_at?: string | null
          generated_at?: string | null
          generation_prompt_version?: number | null
          id?: string
          insights?: Json
          is_dismissed?: boolean | null
          source_data_hash?: string | null
          user_id?: string
          user_role?: Database["public"]["Enums"]["role"]
        }
        Relationships: []
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
          }
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
      assignments: {
        Row: {
          category: string | null
          class_instance_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          name: string
          points_possible: number
          published: boolean | null
          type: Database["public"]["Enums"]["assignment_type"]
          updated_at: string
        }
        Insert: {
          category?: string | null
          class_instance_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          name: string
          points_possible: number
          published?: boolean | null
          type: Database["public"]["Enums"]["assignment_type"]
          updated_at?: string
        }
        Update: {
          category?: string | null
          class_instance_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          name?: string
          points_possible?: number
          published?: boolean | null
          type?: Database["public"]["Enums"]["assignment_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_class_instance_id_fkey"
            columns: ["class_instance_id"]
            isOneToOne: false
            referencedRelation: "class_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      teacher_tool_creations: {
        Row: {
          content: Json
          created_at: string | null
          description: string | null
          id: string
          is_favorite: boolean | null
          metadata: Json | null
          tags: string[] | null
          title: string
          tool_id: string
          tool_name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: Json
          created_at?: string | null
          description?: string | null
          id?: string
          is_favorite?: boolean | null
          metadata?: Json | null
          tags?: string[] | null
          title: string
          tool_id: string
          tool_name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          is_favorite?: boolean | null
          metadata?: Json | null
          tags?: string[] | null
          title?: string
          tool_id?: string
          tool_name?: string
          updated_at?: string | null
          user_id?: string
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
        Relationships: [
          {
            foreignKeyName: "content_indexing_jobs_base_class_id_fkey"
            columns: ["base_class_id"]
            isOneToOne: false
            referencedRelation: "base_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_indexing_jobs_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
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
        Relationships: [
          {
            foreignKeyName: "study_content_index_base_class_id_fkey"
            columns: ["base_class_id"]
            isOneToOne: false
            referencedRelation: "base_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_content_index_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_content_index_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_content_index_parent_content_id_fkey"
            columns: ["parent_content_id"]
            isOneToOne: false
            referencedRelation: "study_content_index"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_content_index_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "paths"
            referencedColumns: ["id"]
          },
        ]
      }
      study_spaces: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_default: boolean | null
          name: string
          organisation_id: string
          settings: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          organisation_id: string
          settings?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          organisation_id?: string
          settings?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_spaces_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      // ... existing code ...
    }
    Functions: {
      upsert_progress: {
        Args: {
          p_user_id: string
          p_item_type: string
          p_item_id: string
          p_status?: string
          p_progress_percentage?: number
          p_last_position?: string
        }
        Returns: string
      }
      cleanup_expired_insights: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
    }
    Enums: {
      assessment_type:
        | "practice"
        | "lesson_quiz"
        | "path_exam"
        | "final_exam"
        | "diagnostic"
        | "benchmark"
      assignment_type:
        | "quiz"
        | "homework"
        | "project"
        | "exam"
        | "discussion"
        | "lab"
        | "assignment"
      audit_action: "INSERT" | "UPDATE" | "DELETE"
      criterion_type: "holistic" | "analytic" | "checklist" | "rating_scale"
      document_status: "queued" | "processing" | "completed" | "error"
      grade_status: "graded" | "missing" | "late" | "excused" | "pending"
      grading_method:
        | "automatic"
        | "manual"
        | "hybrid"
        | "peer_review"
        | "ai_assisted"
      grading_scale_type:
        | "points"
        | "percentage"
        | "letter_grade"
        | "pass_fail"
        | "rubric_scale"
      mastery_level: "below" | "approaching" | "proficient" | "advanced"
      question_type:
        | "multiple_choice"
        | "true_false"
        | "short_answer"
        | "long_answer"
        | "coding"
      role: "super_admin" | "admin" | "teacher" | "student" | "parent"
      user_role: "student" | "teacher" | "admin" | "super_admin" | "parent"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'] 