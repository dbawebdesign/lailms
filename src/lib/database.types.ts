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
      [key: string]: string
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