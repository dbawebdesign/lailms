export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      course_generation_jobs: {
        Row: {
          base_class_id: string | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          job_data: Json | null
          job_type: string
          organisation_id: string
          progress_percentage: number | null
          result_data: Json | null
          started_at: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          base_class_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          job_data?: Json | null
          job_type: string
          organisation_id: string
          progress_percentage?: number | null
          result_data?: Json | null
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          base_class_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          job_data?: Json | null
          job_type?: string
          organisation_id?: string
          progress_percentage?: number | null
          result_data?: Json | null
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
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
      course_outlines: {
        Row: {
          base_class_id: string | null
          created_at: string | null
          description: string | null
          estimated_duration_weeks: number | null
          generation_mode: string
          id: string
          knowledge_base_analysis: Json | null
          learning_objectives: string[] | null
          organisation_id: string
          outline_structure: Json
          status: string | null
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          base_class_id?: string | null
          created_at?: string | null
          description?: string | null
          estimated_duration_weeks?: number | null
          generation_mode: string
          id?: string
          knowledge_base_analysis?: Json | null
          learning_objectives?: string[] | null
          organisation_id: string
          outline_structure: Json
          status?: string | null
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          base_class_id?: string | null
          created_at?: string | null
          description?: string | null
          estimated_duration_weeks?: number | null
          generation_mode?: string
          id?: string
          knowledge_base_analysis?: Json | null
          learning_objectives?: string[] | null
          organisation_id?: string
          outline_structure?: Json
          status?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_outlines_base_class_id_fkey"
            columns: ["base_class_id"]
            isOneToOne: false
            referencedRelation: "base_classes"
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
      base_classes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          organisation_id: string
          settings: Json | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organisation_id: string
          settings?: Json | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organisation_id?: string
          settings?: Json | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "base_classes_organisation_id_fkey"
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
          name: string
          organisation_type: string | null
          settings: Json | null
          updated_at: string
        }
        Insert: {
          abbr?: string | null
          abbreviation?: string | null
          created_at?: string
          id?: string
          name: string
          organisation_type?: string | null
          settings?: Json | null
          updated_at?: string
        }
        Update: {
          abbr?: string | null
          abbreviation?: string | null
          created_at?: string
          id?: string
          name?: string
          organisation_type?: string | null
          settings?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          base_class_id: string | null
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          id: string
          metadata: Json | null
          organisation_id: string
          status: string
          storage_path: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          base_class_id?: string | null
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          metadata?: Json | null
          organisation_id: string
          status?: string
          storage_path: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          base_class_id?: string | null
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          metadata?: Json | null
          organisation_id?: string
          status?: string
          storage_path?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_base_class_id_fkey"
            columns: ["base_class_id"]
            isOneToOne: false
            referencedRelation: "base_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_chunks: {
        Row: {
          chunk_index: number
          chunk_summary: string | null
          citation_key: string | null
          content: string
          created_at: string
          document_id: string
          embedding: string | null
          id: string
          metadata: Json | null
          organisation_id: string
          section_identifier: string | null
          section_summary: string | null
          section_summary_status: string | null
          summary_status: string | null
          token_count: number
          updated_at: string
        }
        Insert: {
          chunk_index: number
          chunk_summary?: string | null
          citation_key?: string | null
          content: string
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          organisation_id: string
          section_identifier?: string | null
          section_summary?: string | null
          section_summary_status?: string | null
          summary_status?: string | null
          token_count: number
          updated_at?: string
        }
        Update: {
          chunk_index?: number
          chunk_summary?: string | null
          citation_key?: string | null
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          organisation_id?: string
          section_identifier?: string | null
          section_summary?: string | null
          section_summary_status?: string | null
          summary_status?: string | null
          token_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_chunks_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
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
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Type helpers
type Tables<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type { Tables } 