export type Json = string | number | boolean | null | {
    [key: string]: Json | undefined;
} | Json[];
export type Database = {
    __InternalSupabase: {
        PostgrestVersion: "12.2.3 (519615d)";
    };
    public: {
        Tables: {
            agent_analytics: {
                Row: {
                    agent_type: string;
                    average_response_time: number | null;
                    created_at: string | null;
                    id: string;
                    interaction_count: number | null;
                    session_id: string;
                    success_rate: number | null;
                    tools_used: Json | null;
                    updated_at: string | null;
                    user_id: string | null;
                    user_satisfaction: number | null;
                };
                Insert: {
                    agent_type: string;
                    average_response_time?: number | null;
                    created_at?: string | null;
                    id?: string;
                    interaction_count?: number | null;
                    session_id: string;
                    success_rate?: number | null;
                    tools_used?: Json | null;
                    updated_at?: string | null;
                    user_id?: string | null;
                    user_satisfaction?: number | null;
                };
                Update: {
                    agent_type?: string;
                    average_response_time?: number | null;
                    created_at?: string | null;
                    id?: string;
                    interaction_count?: number | null;
                    session_id?: string;
                    success_rate?: number | null;
                    tools_used?: Json | null;
                    updated_at?: string | null;
                    user_id?: string | null;
                    user_satisfaction?: number | null;
                };
                Relationships: [];
            };
            agent_messages: {
                Row: {
                    agent_type: string;
                    citations: Json | null;
                    content: string;
                    created_at: string | null;
                    id: string;
                    metadata: Json | null;
                    role: string;
                    session_id: string | null;
                    user_id: string | null;
                };
                Insert: {
                    agent_type: string;
                    citations?: Json | null;
                    content: string;
                    created_at?: string | null;
                    id?: string;
                    metadata?: Json | null;
                    role: string;
                    session_id?: string | null;
                    user_id?: string | null;
                };
                Update: {
                    agent_type?: string;
                    citations?: Json | null;
                    content?: string;
                    created_at?: string | null;
                    id?: string;
                    metadata?: Json | null;
                    role?: string;
                    session_id?: string | null;
                    user_id?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "agent_messages_session_id_fkey";
                        columns: ["session_id"];
                        isOneToOne: false;
                        referencedRelation: "agent_sessions";
                        referencedColumns: ["id"];
                    }
                ];
            };
            agent_performance_summary: {
                Row: {
                    agent_type: string;
                    average_response_time: number | null;
                    created_at: string | null;
                    date: string;
                    id: string;
                    satisfaction_score: number | null;
                    successful_interactions: number | null;
                    total_interactions: number | null;
                    total_tool_uses: number | null;
                    unique_users: number | null;
                    updated_at: string | null;
                };
                Insert: {
                    agent_type: string;
                    average_response_time?: number | null;
                    created_at?: string | null;
                    date: string;
                    id?: string;
                    satisfaction_score?: number | null;
                    successful_interactions?: number | null;
                    total_interactions?: number | null;
                    total_tool_uses?: number | null;
                    unique_users?: number | null;
                    updated_at?: string | null;
                };
                Update: {
                    agent_type?: string;
                    average_response_time?: number | null;
                    created_at?: string | null;
                    date?: string;
                    id?: string;
                    satisfaction_score?: number | null;
                    successful_interactions?: number | null;
                    total_interactions?: number | null;
                    total_tool_uses?: number | null;
                    unique_users?: number | null;
                    updated_at?: string | null;
                };
                Relationships: [];
            };
            agent_real_time_updates: {
                Row: {
                    agent_type: string;
                    content: string | null;
                    created_at: string | null;
                    id: string;
                    metadata: Json | null;
                    session_id: string | null;
                    update_type: string;
                    user_id: string | null;
                };
                Insert: {
                    agent_type: string;
                    content?: string | null;
                    created_at?: string | null;
                    id?: string;
                    metadata?: Json | null;
                    session_id?: string | null;
                    update_type: string;
                    user_id?: string | null;
                };
                Update: {
                    agent_type?: string;
                    content?: string | null;
                    created_at?: string | null;
                    id?: string;
                    metadata?: Json | null;
                    session_id?: string | null;
                    update_type?: string;
                    user_id?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "agent_real_time_updates_session_id_fkey";
                        columns: ["session_id"];
                        isOneToOne: false;
                        referencedRelation: "agent_sessions";
                        referencedColumns: ["id"];
                    }
                ];
            };
            agent_sessions: {
                Row: {
                    agent_type: string;
                    context: Json | null;
                    ended_at: string | null;
                    id: string;
                    metadata: Json | null;
                    started_at: string | null;
                    status: string | null;
                    user_id: string | null;
                };
                Insert: {
                    agent_type: string;
                    context?: Json | null;
                    ended_at?: string | null;
                    id?: string;
                    metadata?: Json | null;
                    started_at?: string | null;
                    status?: string | null;
                    user_id?: string | null;
                };
                Update: {
                    agent_type?: string;
                    context?: Json | null;
                    ended_at?: string | null;
                    id?: string;
                    metadata?: Json | null;
                    started_at?: string | null;
                    status?: string | null;
                    user_id?: string | null;
                };
                Relationships: [];
            };
            agent_tool_usage: {
                Row: {
                    agent_type: string;
                    created_at: string | null;
                    error_message: string | null;
                    execution_time: number | null;
                    id: string;
                    input_data: Json | null;
                    output_data: Json | null;
                    session_id: string | null;
                    success: boolean | null;
                    tool_name: string;
                    user_id: string | null;
                };
                Insert: {
                    agent_type: string;
                    created_at?: string | null;
                    error_message?: string | null;
                    execution_time?: number | null;
                    id?: string;
                    input_data?: Json | null;
                    output_data?: Json | null;
                    session_id?: string | null;
                    success?: boolean | null;
                    tool_name: string;
                    user_id?: string | null;
                };
                Update: {
                    agent_type?: string;
                    created_at?: string | null;
                    error_message?: string | null;
                    execution_time?: number | null;
                    id?: string;
                    input_data?: Json | null;
                    output_data?: Json | null;
                    session_id?: string | null;
                    success?: boolean | null;
                    tool_name?: string;
                    user_id?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "agent_tool_usage_session_id_fkey";
                        columns: ["session_id"];
                        isOneToOne: false;
                        referencedRelation: "agent_sessions";
                        referencedColumns: ["id"];
                    }
                ];
            };
            ai_tool_interactions: {
                Row: {
                    assessment_session_id: string;
                    id: string;
                    interaction_type: string;
                    metadata: Json | null;
                    prompt_text: string | null;
                    question_id: string | null;
                    response_text: string | null;
                    timestamp: string;
                    token_usage: Json | null;
                    tool_type: string;
                };
                Insert: {
                    assessment_session_id: string;
                    id?: string;
                    interaction_type: string;
                    metadata?: Json | null;
                    prompt_text?: string | null;
                    question_id?: string | null;
                    response_text?: string | null;
                    timestamp?: string;
                    token_usage?: Json | null;
                    tool_type: string;
                };
                Update: {
                    assessment_session_id?: string;
                    id?: string;
                    interaction_type?: string;
                    metadata?: Json | null;
                    prompt_text?: string | null;
                    question_id?: string | null;
                    response_text?: string | null;
                    timestamp?: string;
                    token_usage?: Json | null;
                    tool_type?: string;
                };
                Relationships: [];
            };
            ai_insights: {
                Row: {
                    dismissed_at: string | null;
                    expires_at: string | null;
                    generated_at: string | null;
                    generation_prompt_version: number | null;
                    id: string;
                    insights: Json;
                    is_dismissed: boolean | null;
                    source_data_hash: string | null;
                    user_id: string;
                    user_role: Database["public"]["Enums"]["role"];
                };
                Insert: {
                    dismissed_at?: string | null;
                    expires_at?: string | null;
                    generated_at?: string | null;
                    generation_prompt_version?: number | null;
                    id?: string;
                    insights: Json;
                    is_dismissed?: boolean | null;
                    source_data_hash?: string | null;
                    user_id: string;
                    user_role: Database["public"]["Enums"]["role"];
                };
                Update: {
                    dismissed_at?: string | null;
                    expires_at?: string | null;
                    generated_at?: string | null;
                    generation_prompt_version?: number | null;
                    id?: string;
                    insights?: Json;
                    is_dismissed?: boolean | null;
                    source_data_hash?: string | null;
                    user_id?: string;
                    user_role?: Database["public"]["Enums"]["role"];
                };
                Relationships: [
                    {
                        foreignKeyName: "ai_insights_user_id_fkey";
                        columns: ["user_id"];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: ["user_id"];
                    }
                ];
            };
            assessment_questions: {
                Row: {
                    ai_grading_enabled: boolean | null;
                    answer_key: Json;
                    assessment_id: string;
                    correct_answer: Json | null;
                    created_at: string | null;
                    explanation: string | null;
                    grading_rubric: Json | null;
                    id: string;
                    options: Json | null;
                    order_index: number;
                    points: number | null;
                    question_text: string;
                    question_text_tsvector: unknown | null;
                    question_type: string;
                    required: boolean | null;
                    sample_response: string | null;
                    sample_response_tsvector: unknown | null;
                    updated_at: string | null;
                };
                Insert: {
                    ai_grading_enabled?: boolean | null;
                    answer_key: Json;
                    assessment_id: string;
                    correct_answer?: Json | null;
                    created_at?: string | null;
                    explanation?: string | null;
                    grading_rubric?: Json | null;
                    id?: string;
                    options?: Json | null;
                    order_index: number;
                    points?: number | null;
                    question_text: string;
                    question_text_tsvector?: unknown | null;
                    question_type: string;
                    required?: boolean | null;
                    sample_response?: string | null;
                    sample_response_tsvector?: unknown | null;
                    updated_at?: string | null;
                };
                Update: {
                    ai_grading_enabled?: boolean | null;
                    answer_key?: Json;
                    assessment_id?: string;
                    correct_answer?: Json | null;
                    created_at?: string | null;
                    explanation?: string | null;
                    grading_rubric?: Json | null;
                    id?: string;
                    options?: Json | null;
                    order_index?: number;
                    points?: number | null;
                    question_text?: string;
                    question_text_tsvector?: unknown | null;
                    question_type?: string;
                    required?: boolean | null;
                    sample_response?: string | null;
                    sample_response_tsvector?: unknown | null;
                    updated_at?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "assessment_questions_assessment_id_fkey";
                        columns: ["assessment_id"];
                        isOneToOne: false;
                        referencedRelation: "assessments";
                        referencedColumns: ["id"];
                    }
                ];
            };
            assessments: {
                Row: {
                    ai_grading_enabled: boolean | null;
                    ai_model: string | null;
                    allow_review: boolean | null;
                    assessment_type: string;
                    base_class_id: string;
                    created_at: string | null;
                    created_by: string | null;
                    description: string | null;
                    id: string;
                    instructions: string | null;
                    lesson_id: string | null;
                    max_attempts: number | null;
                    passing_score_percentage: number | null;
                    path_id: string | null;
                    randomize_questions: boolean | null;
                    show_results_immediately: boolean | null;
                    time_limit_minutes: number | null;
                    title: string;
                    updated_at: string | null;
                };
                Insert: {
                    ai_grading_enabled?: boolean | null;
                    ai_model?: string | null;
                    allow_review?: boolean | null;
                    assessment_type: string;
                    base_class_id: string;
                    created_at?: string | null;
                    created_by?: string | null;
                    description?: string | null;
                    id?: string;
                    instructions?: string | null;
                    lesson_id?: string | null;
                    max_attempts?: number | null;
                    passing_score_percentage?: number | null;
                    path_id?: string | null;
                    randomize_questions?: boolean | null;
                    show_results_immediately?: boolean | null;
                    time_limit_minutes?: number | null;
                    title: string;
                    updated_at?: string | null;
                };
                Update: {
                    ai_grading_enabled?: boolean | null;
                    ai_model?: string | null;
                    allow_review?: boolean | null;
                    assessment_type?: string;
                    base_class_id?: string;
                    created_at?: string | null;
                    created_by?: string | null;
                    description?: string | null;
                    id?: string;
                    instructions?: string | null;
                    lesson_id?: string | null;
                    max_attempts?: number | null;
                    passing_score_percentage?: number | null;
                    path_id?: string | null;
                    randomize_questions?: boolean | null;
                    show_results_immediately?: boolean | null;
                    time_limit_minutes?: number | null;
                    title?: string;
                    updated_at?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "assessments_base_class_id_fkey";
                        columns: ["base_class_id"];
                        isOneToOne: false;
                        referencedRelation: "base_classes";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "assessments_created_by_fkey";
                        columns: ["created_by"];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: ["user_id"];
                    },
                    {
                        foreignKeyName: "assessments_lesson_id_fkey";
                        columns: ["lesson_id"];
                        isOneToOne: false;
                        referencedRelation: "lessons";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "assessments_path_id_fkey";
                        columns: ["path_id"];
                        isOneToOne: false;
                        referencedRelation: "paths";
                        referencedColumns: ["id"];
                    }
                ];
            };
            assignment_standards: {
                Row: {
                    assignment_id: string;
                    standard_id: string;
                };
                Insert: {
                    assignment_id: string;
                    standard_id: string;
                };
                Update: {
                    assignment_id?: string;
                    standard_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "assignment_standards_assignment_id_fkey";
                        columns: ["assignment_id"];
                        isOneToOne: false;
                        referencedRelation: "assignments";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "assignment_standards_standard_id_fkey";
                        columns: ["standard_id"];
                        isOneToOne: false;
                        referencedRelation: "standards";
                        referencedColumns: ["id"];
                    }
                ];
            };
            assignments: {
                Row: {
                    category: string | null;
                    class_instance_id: string | null;
                    created_at: string;
                    created_by: string | null;
                    description: string | null;
                    due_date: string | null;
                    id: string;
                    name: string;
                    points_possible: number;
                    published: boolean | null;
                    type: Database["public"]["Enums"]["assignment_type"];
                    updated_at: string;
                };
                Insert: {
                    category?: string | null;
                    class_instance_id?: string | null;
                    created_at?: string;
                    created_by?: string | null;
                    description?: string | null;
                    due_date?: string | null;
                    id?: string;
                    name: string;
                    points_possible: number;
                    published?: boolean | null;
                    type: Database["public"]["Enums"]["assignment_type"];
                    updated_at?: string;
                };
                Update: {
                    category?: string | null;
                    class_instance_id?: string | null;
                    created_at?: string;
                    created_by?: string | null;
                    description?: string | null;
                    due_date?: string | null;
                    id?: string;
                    name?: string;
                    points_possible?: number;
                    published?: boolean | null;
                    type?: Database["public"]["Enums"]["assignment_type"];
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "assignments_class_instance_id_fkey";
                        columns: ["class_instance_id"];
                        isOneToOne: false;
                        referencedRelation: "class_instances";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "assignments_created_by_fkey";
                        columns: ["created_by"];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: ["user_id"];
                    }
                ];
            };
            audit_logs: {
                Row: {
                    action: Database["public"]["Enums"]["audit_action"];
                    id: number;
                    new_data: Json | null;
                    old_data: Json | null;
                    performed_at: string;
                    performed_by: string | null;
                    record_id: string | null;
                    table_name: string;
                };
                Insert: {
                    action: Database["public"]["Enums"]["audit_action"];
                    id?: number;
                    new_data?: Json | null;
                    old_data?: Json | null;
                    performed_at?: string;
                    performed_by?: string | null;
                    record_id?: string | null;
                    table_name: string;
                };
                Update: {
                    action?: Database["public"]["Enums"]["audit_action"];
                    id?: number;
                    new_data?: Json | null;
                    old_data?: Json | null;
                    performed_at?: string;
                    performed_by?: string | null;
                    record_id?: string | null;
                    table_name?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "audit_logs_performed_by_fkey";
                        columns: ["performed_by"];
                        isOneToOne: false;
                        referencedRelation: "members";
                        referencedColumns: ["id"];
                    }
                ];
            };
            base_class_media_assets: {
                Row: {
                    asset_type: string;
                    base_class_id: string;
                    content: Json | null;
                    created_at: string;
                    created_by: string;
                    duration: number | null;
                    error_message: string | null;
                    file_size: number | null;
                    file_url: string | null;
                    id: string;
                    status: string;
                    svg_content: string | null;
                    title: string;
                    updated_at: string;
                };
                Insert: {
                    asset_type: string;
                    base_class_id: string;
                    content?: Json | null;
                    created_at?: string;
                    created_by: string;
                    duration?: number | null;
                    error_message?: string | null;
                    file_size?: number | null;
                    file_url?: string | null;
                    id?: string;
                    status?: string;
                    svg_content?: string | null;
                    title: string;
                    updated_at?: string;
                };
                Update: {
                    asset_type?: string;
                    base_class_id?: string;
                    content?: Json | null;
                    created_at?: string;
                    created_by?: string;
                    duration?: number | null;
                    error_message?: string | null;
                    file_size?: number | null;
                    file_url?: string | null;
                    id?: string;
                    status?: string;
                    svg_content?: string | null;
                    title?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "base_class_media_assets_base_class_id_fkey";
                        columns: ["base_class_id"];
                        isOneToOne: false;
                        referencedRelation: "base_classes";
                        referencedColumns: ["id"];
                    }
                ];
            };
            base_classes: {
                Row: {
                    assessment_config: Json | null;
                    created_at: string;
                    description: string | null;
                    id: string;
                    name: string;
                    organisation_id: string;
                    settings: Json | null;
                    updated_at: string;
                    user_id: string | null;
                };
                Insert: {
                    assessment_config?: Json | null;
                    created_at?: string;
                    description?: string | null;
                    id?: string;
                    name: string;
                    organisation_id: string;
                    settings?: Json | null;
                    updated_at?: string;
                    user_id?: string | null;
                };
                Update: {
                    assessment_config?: Json | null;
                    created_at?: string;
                    description?: string | null;
                    id?: string;
                    name?: string;
                    organisation_id?: string;
                    settings?: Json | null;
                    updated_at?: string;
                    user_id?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "base_classes_organisation_id_fkey";
                        columns: ["organisation_id"];
                        isOneToOne: false;
                        referencedRelation: "organisations";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "fk_user";
                        columns: ["user_id"];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: ["user_id"];
                    }
                ];
            };
            class_instances: {
                Row: {
                    base_class_id: string;
                    created_at: string;
                    end_date: string | null;
                    enrollment_code: string;
                    id: string;
                    name: string;
                    settings: Json | null;
                    start_date: string | null;
                    status: string | null;
                    updated_at: string;
                };
                Insert: {
                    base_class_id: string;
                    created_at?: string;
                    end_date?: string | null;
                    enrollment_code?: string;
                    id?: string;
                    name: string;
                    settings?: Json | null;
                    start_date?: string | null;
                    status?: string | null;
                    updated_at?: string;
                };
                Update: {
                    base_class_id?: string;
                    created_at?: string;
                    end_date?: string | null;
                    enrollment_code?: string;
                    id?: string;
                    name?: string;
                    settings?: Json | null;
                    start_date?: string | null;
                    status?: string | null;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "class_instances_base_class_id_fkey";
                        columns: ["base_class_id"];
                        isOneToOne: false;
                        referencedRelation: "base_classes";
                        referencedColumns: ["id"];
                    }
                ];
            };
            collaborative_participants: {
                Row: {
                    collaborative_session_id: string;
                    contribution_score: number | null;
                    id: string;
                    joined_at: string;
                    left_at: string | null;
                    member_id: string;
                    participation_data: Json | null;
                    role: string | null;
                };
                Insert: {
                    collaborative_session_id: string;
                    contribution_score?: number | null;
                    id?: string;
                    joined_at?: string;
                    left_at?: string | null;
                    member_id: string;
                    participation_data?: Json | null;
                    role?: string | null;
                };
                Update: {
                    collaborative_session_id?: string;
                    contribution_score?: number | null;
                    id?: string;
                    joined_at?: string;
                    left_at?: string | null;
                    member_id?: string;
                    participation_data?: Json | null;
                    role?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "collaborative_participants_collaborative_session_id_fkey";
                        columns: ["collaborative_session_id"];
                        isOneToOne: false;
                        referencedRelation: "collaborative_sessions";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "collaborative_participants_member_id_fkey";
                        columns: ["member_id"];
                        isOneToOne: false;
                        referencedRelation: "members";
                        referencedColumns: ["id"];
                    }
                ];
            };
            collaborative_sessions: {
                Row: {
                    ai_mediator_config: Json | null;
                    collaboration_rules: Json | null;
                    created_at: string;
                    created_by: string | null;
                    ended_at: string | null;
                    id: string;
                    max_participants: number | null;
                    quiz_id: string;
                    session_name: string;
                    started_at: string | null;
                    status: string | null;
                    updated_at: string;
                };
                Insert: {
                    ai_mediator_config?: Json | null;
                    collaboration_rules?: Json | null;
                    created_at?: string;
                    created_by?: string | null;
                    ended_at?: string | null;
                    id?: string;
                    max_participants?: number | null;
                    quiz_id: string;
                    session_name: string;
                    started_at?: string;
                    status?: string | null;
                    updated_at?: string;
                };
                Update: {
                    ai_mediator_config?: Json | null;
                    collaboration_rules?: Json | null;
                    created_at?: string;
                    created_by?: string | null;
                    ended_at?: string | null;
                    id?: string;
                    max_participants?: number | null;
                    quiz_id?: string;
                    session_name?: string;
                    started_at?: string;
                    status?: string | null;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "collaborative_sessions_created_by_fkey";
                        columns: ["created_by"];
                        isOneToOne: false;
                        referencedRelation: "members";
                        referencedColumns: ["id"];
                    }
                ];
            };
            course_generation_jobs: {
                Row: {
                    base_class_id: string | null;
                    completed_at: string | null;
                    confetti_shown: boolean | null;
                    created_at: string | null;
                    error_message: string | null;
                    id: string;
                    is_cleared: boolean;
                    job_data: Json | null;
                    job_type: string;
                    organisation_id: string;
                    progress_percentage: number | null;
                    result_data: Json | null;
                    started_at: string | null;
                    status: string | null;
                    updated_at: string | null;
                    user_id: string | null;
                };
                Insert: {
                    base_class_id?: string | null;
                    completed_at?: string | null;
                    confetti_shown?: boolean | null;
                    created_at?: string | null;
                    error_message?: string | null;
                    id?: string;
                    is_cleared?: boolean;
                    job_data?: Json | null;
                    job_type: string;
                    organisation_id: string;
                    progress_percentage?: number | null;
                    result_data?: Json | null;
                    started_at?: string | null;
                    status?: string | null;
                    updated_at?: string | null;
                    user_id?: string | null;
                };
                Update: {
                    base_class_id?: string | null;
                    completed_at?: string | null;
                    confetti_shown?: boolean | null;
                    created_at?: string | null;
                    error_message?: string | null;
                    id?: string;
                    is_cleared?: boolean;
                    job_data?: Json | null;
                    job_type?: string;
                    organisation_id?: string;
                    progress_percentage?: number | null;
                    result_data?: Json | null;
                    started_at?: string | null;
                    status?: string | null;
                    updated_at?: string | null;
                    user_id?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "course_generation_jobs_base_class_id_fkey";
                        columns: ["base_class_id"];
                        isOneToOne: false;
                        referencedRelation: "base_classes";
                        referencedColumns: ["id"];
                    }
                ];
            };
            course_outlines: {
                Row: {
                    academic_level: string | null;
                    assessment_settings: Json | null;
                    base_class_id: string | null;
                    created_at: string | null;
                    description: string | null;
                    estimated_duration_weeks: number | null;
                    generation_mode: string;
                    id: string;
                    knowledge_base_analysis: Json | null;
                    learning_objectives: string[] | null;
                    lesson_detail_level: string | null;
                    lessons_per_week: number | null;
                    organisation_id: string;
                    outline_structure: Json;
                    prerequisites: string | null;
                    status: string | null;
                    target_audience: string | null;
                    title: string;
                    updated_at: string | null;
                    user_id: string | null;
                };
                Insert: {
                    academic_level?: string | null;
                    assessment_settings?: Json | null;
                    base_class_id?: string | null;
                    created_at?: string | null;
                    description?: string | null;
                    estimated_duration_weeks?: number | null;
                    generation_mode: string;
                    id?: string;
                    knowledge_base_analysis?: Json | null;
                    learning_objectives?: string[] | null;
                    lesson_detail_level?: string | null;
                    lessons_per_week?: number | null;
                    organisation_id: string;
                    outline_structure: Json;
                    prerequisites?: string | null;
                    status?: string | null;
                    target_audience?: string | null;
                    title: string;
                    updated_at?: string | null;
                    user_id?: string | null;
                };
                Update: {
                    academic_level?: string | null;
                    assessment_settings?: Json | null;
                    base_class_id?: string | null;
                    created_at?: string | null;
                    description?: string | null;
                    estimated_duration_weeks?: number | null;
                    generation_mode?: string;
                    id?: string;
                    knowledge_base_analysis?: Json | null;
                    learning_objectives?: string[] | null;
                    lesson_detail_level?: string | null;
                    lessons_per_week?: number | null;
                    organisation_id?: string;
                    outline_structure?: Json;
                    prerequisites?: string | null;
                    status?: string | null;
                    target_audience?: string | null;
                    title?: string;
                    updated_at?: string | null;
                    user_id?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "course_outlines_base_class_id_fkey";
                        columns: ["base_class_id"];
                        isOneToOne: false;
                        referencedRelation: "base_classes";
                        referencedColumns: ["id"];
                    }
                ];
            };
            document_chunks: {
                Row: {
                    chunk_index: number;
                    chunk_summary: string | null;
                    citation_key: string | null;
                    content: string;
                    created_at: string;
                    document_id: string;
                    embedding: string | null;
                    id: string;
                    metadata: Json | null;
                    organisation_id: string;
                    section_identifier: string | null;
                    section_summary: string | null;
                    section_summary_status: string | null;
                    summary_status: string | null;
                    token_count: number;
                    updated_at: string;
                };
                Insert: {
                    chunk_index: number;
                    chunk_summary?: string | null;
                    citation_key?: string | null;
                    content: string;
                    created_at?: string;
                    document_id: string;
                    embedding?: string | null;
                    id?: string;
                    metadata?: Json | null;
                    organisation_id: string;
                    section_identifier?: string | null;
                    section_summary?: string | null;
                    section_summary_status?: string | null;
                    summary_status?: string | null;
                    token_count: number;
                    updated_at?: string;
                };
                Update: {
                    chunk_index?: number;
                    chunk_summary?: string | null;
                    citation_key?: string | null;
                    content?: string;
                    created_at?: string;
                    document_id?: string;
                    embedding?: string | null;
                    id?: string;
                    metadata?: Json | null;
                    organisation_id?: string;
                    section_identifier?: string | null;
                    section_summary?: string | null;
                    section_summary_status?: string | null;
                    summary_status?: string | null;
                    token_count?: number;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "document_chunks_document_id_fkey";
                        columns: ["document_id"];
                        isOneToOne: false;
                        referencedRelation: "documents";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "document_chunks_document_id_fkey";
                        columns: ["document_id"];
                        isOneToOne: false;
                        referencedRelation: "youtube_processing_analytics";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "document_chunks_organisation_id_fkey";
                        columns: ["organisation_id"];
                        isOneToOne: false;
                        referencedRelation: "organisations";
                        referencedColumns: ["id"];
                    }
                ];
            };
            document_summaries: {
                Row: {
                    completion_tokens: number | null;
                    created_at: string;
                    document_id: string;
                    id: string;
                    model_used: string | null;
                    organisation_id: string;
                    prompt_tokens: number | null;
                    status: string;
                    summary: string;
                    summary_level: string;
                    total_tokens: number | null;
                    updated_at: string;
                };
                Insert: {
                    completion_tokens?: number | null;
                    created_at?: string;
                    document_id: string;
                    id?: string;
                    model_used?: string | null;
                    organisation_id: string;
                    prompt_tokens?: number | null;
                    status?: string;
                    summary: string;
                    summary_level: string;
                    total_tokens?: number | null;
                    updated_at?: string;
                };
                Update: {
                    completion_tokens?: number | null;
                    created_at?: string;
                    document_id?: string;
                    id?: string;
                    model_used?: string | null;
                    organisation_id?: string;
                    prompt_tokens?: number | null;
                    status?: string;
                    summary?: string;
                    summary_level?: string;
                    total_tokens?: number | null;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "document_summaries_document_id_fkey";
                        columns: ["document_id"];
                        isOneToOne: false;
                        referencedRelation: "documents";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "document_summaries_document_id_fkey";
                        columns: ["document_id"];
                        isOneToOne: false;
                        referencedRelation: "youtube_processing_analytics";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "document_summaries_organisation_id_fkey";
                        columns: ["organisation_id"];
                        isOneToOne: false;
                        referencedRelation: "organisations";
                        referencedColumns: ["id"];
                    }
                ];
            };
            documents: {
                Row: {
                    base_class_id: string | null;
                    created_at: string;
                    file_name: string;
                    file_size: number | null;
                    file_type: string | null;
                    id: string;
                    metadata: Json | null;
                    organisation_id: string;
                    status: string;
                    storage_path: string;
                    updated_at: string;
                    uploaded_by: string;
                };
                Insert: {
                    base_class_id?: string | null;
                    created_at?: string;
                    file_name: string;
                    file_size?: number | null;
                    file_type?: string | null;
                    id?: string;
                    metadata?: Json | null;
                    organisation_id: string;
                    status?: string;
                    storage_path: string;
                    updated_at?: string;
                    uploaded_by: string;
                };
                Update: {
                    base_class_id?: string | null;
                    created_at?: string;
                    file_name?: string;
                    file_size?: number | null;
                    file_type?: string | null;
                    id?: string;
                    metadata?: Json | null;
                    organisation_id?: string;
                    status?: string;
                    storage_path?: string;
                    updated_at?: string;
                    uploaded_by?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "documents_base_class_id_fkey";
                        columns: ["base_class_id"];
                        isOneToOne: false;
                        referencedRelation: "base_classes";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "documents_organisation_id_fkey";
                        columns: ["organisation_id"];
                        isOneToOne: false;
                        referencedRelation: "organisations";
                        referencedColumns: ["id"];
                    }
                ];
            };
            dynamic_problems: {
                Row: {
                    base_class_id: string | null;
                    created_at: string;
                    created_by: string | null;
                    description: string | null;
                    difficulty_range: unknown | null;
                    id: string;
                    name: string;
                    parameter_definitions: Json;
                    solution_template: Json | null;
                    subject_area: string | null;
                    tags: string[] | null;
                    template_data: Json;
                    updated_at: string;
                };
                Insert: {
                    base_class_id?: string | null;
                    created_at?: string;
                    created_by?: string | null;
                    description?: string | null;
                    difficulty_range?: unknown | null;
                    id?: string;
                    name: string;
                    parameter_definitions?: Json;
                    solution_template?: Json | null;
                    subject_area?: string | null;
                    tags?: string[] | null;
                    template_data?: Json;
                    updated_at?: string;
                };
                Update: {
                    base_class_id?: string | null;
                    created_at?: string;
                    created_by?: string | null;
                    description?: string | null;
                    difficulty_range?: unknown | null;
                    id?: string;
                    name?: string;
                    parameter_definitions?: Json;
                    solution_template?: Json | null;
                    subject_area?: string | null;
                    tags?: string[] | null;
                    template_data?: Json;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "dynamic_problems_base_class_id_fkey";
                        columns: ["base_class_id"];
                        isOneToOne: false;
                        referencedRelation: "base_classes";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "dynamic_problems_created_by_fkey";
                        columns: ["created_by"];
                        isOneToOne: false;
                        referencedRelation: "members";
                        referencedColumns: ["id"];
                    }
                ];
            };
            feedback_records: {
                Row: {
                    content: Json;
                    created_at: string | null;
                    feedback_type: string;
                    id: string;
                    metadata: Json;
                    personalization: Json;
                    response_id: string;
                    response_type: string;
                    tone: string;
                    updated_at: string | null;
                };
                Insert: {
                    content: Json;
                    created_at?: string | null;
                    feedback_type: string;
                    id?: string;
                    metadata: Json;
                    personalization: Json;
                    response_id: string;
                    response_type: string;
                    tone: string;
                    updated_at?: string | null;
                };
                Update: {
                    content?: Json;
                    created_at?: string | null;
                    feedback_type?: string;
                    id?: string;
                    metadata?: Json;
                    personalization?: Json;
                    response_id?: string;
                    response_type?: string;
                    tone?: string;
                    updated_at?: string | null;
                };
                Relationships: [];
            };
            feedback_templates: {
                Row: {
                    base_class_id: string | null;
                    cognitive_levels: string[] | null;
                    created_at: string;
                    created_by: string | null;
                    id: string;
                    name: string;
                    question_types: string[] | null;
                    template_text: string;
                    template_type: string | null;
                    updated_at: string;
                    variables: Json | null;
                };
                Insert: {
                    base_class_id?: string | null;
                    cognitive_levels?: string[] | null;
                    created_at?: string;
                    created_by?: string | null;
                    id?: string;
                    name: string;
                    question_types?: string[] | null;
                    template_text: string;
                    template_type?: string | null;
                    updated_at?: string;
                    variables?: Json | null;
                };
                Update: {
                    base_class_id?: string | null;
                    cognitive_levels?: string[] | null;
                    created_at?: string;
                    created_by?: string | null;
                    id?: string;
                    name?: string;
                    question_types?: string[] | null;
                    template_text?: string;
                    template_type?: string | null;
                    updated_at?: string;
                    variables?: Json | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "feedback_templates_base_class_id_fkey";
                        columns: ["base_class_id"];
                        isOneToOne: false;
                        referencedRelation: "base_classes";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "feedback_templates_created_by_fkey";
                        columns: ["created_by"];
                        isOneToOne: false;
                        referencedRelation: "members";
                        referencedColumns: ["id"];
                    }
                ];
            };
            generated_lesson_content: {
                Row: {
                    content_type: string;
                    course_outline_id: string | null;
                    created_at: string | null;
                    generated_content: Json;
                    generation_metadata: Json | null;
                    id: string;
                    lesson_id: string | null;
                    organisation_id: string;
                    source_chunks: string[] | null;
                    status: string | null;
                    updated_at: string | null;
                    user_id: string | null;
                };
                Insert: {
                    content_type: string;
                    course_outline_id?: string | null;
                    created_at?: string | null;
                    generated_content: Json;
                    generation_metadata?: Json | null;
                    id?: string;
                    lesson_id?: string | null;
                    organisation_id: string;
                    source_chunks?: string[] | null;
                    status?: string | null;
                    updated_at?: string | null;
                    user_id?: string | null;
                };
                Update: {
                    content_type?: string;
                    course_outline_id?: string | null;
                    created_at?: string | null;
                    generated_content?: Json;
                    generation_metadata?: Json | null;
                    id?: string;
                    lesson_id?: string | null;
                    organisation_id?: string;
                    source_chunks?: string[] | null;
                    status?: string | null;
                    updated_at?: string | null;
                    user_id?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "generated_lesson_content_course_outline_id_fkey";
                        columns: ["course_outline_id"];
                        isOneToOne: false;
                        referencedRelation: "course_outlines";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "generated_lesson_content_lesson_id_fkey";
                        columns: ["lesson_id"];
                        isOneToOne: false;
                        referencedRelation: "lessons";
                        referencedColumns: ["id"];
                    }
                ];
            };
            generation_citations: {
                Row: {
                    chunk_id: string;
                    context_position: number | null;
                    created_at: string;
                    generation_id: string;
                    id: string;
                    relevance_score: number | null;
                };
                Insert: {
                    chunk_id: string;
                    context_position?: number | null;
                    created_at?: string;
                    generation_id: string;
                    id?: string;
                    relevance_score?: number | null;
                };
                Update: {
                    chunk_id?: string;
                    context_position?: number | null;
                    created_at?: string;
                    generation_id?: string;
                    id?: string;
                    relevance_score?: number | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "generation_citations_chunk_id_fkey";
                        columns: ["chunk_id"];
                        isOneToOne: false;
                        referencedRelation: "document_chunks";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "generation_citations_generation_id_fkey";
                        columns: ["generation_id"];
                        isOneToOne: false;
                        referencedRelation: "generations";
                        referencedColumns: ["id"];
                    }
                ];
            };
            generations: {
                Row: {
                    asset_id: string | null;
                    asset_type: string;
                    completion_tokens: number | null;
                    created_at: string;
                    error_message: string | null;
                    id: string;
                    model_used: string | null;
                    organisation_id: string;
                    prompt_tokens: number | null;
                    query: string | null;
                    response: string | null;
                    status: string;
                    total_tokens: number | null;
                    updated_at: string;
                    user_id: string | null;
                };
                Insert: {
                    asset_id?: string | null;
                    asset_type: string;
                    completion_tokens?: number | null;
                    created_at?: string;
                    error_message?: string | null;
                    id?: string;
                    model_used?: string | null;
                    organisation_id: string;
                    prompt_tokens?: number | null;
                    query?: string | null;
                    response?: string | null;
                    status?: string;
                    total_tokens?: number | null;
                    updated_at?: string;
                    user_id?: string | null;
                };
                Update: {
                    asset_id?: string | null;
                    asset_type?: string;
                    completion_tokens?: number | null;
                    created_at?: string;
                    error_message?: string | null;
                    id?: string;
                    model_used?: string | null;
                    organisation_id?: string;
                    prompt_tokens?: number | null;
                    query?: string | null;
                    response?: string | null;
                    status?: string;
                    total_tokens?: number | null;
                    updated_at?: string;
                    user_id?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "generations_organisation_id_fkey";
                        columns: ["organisation_id"];
                        isOneToOne: false;
                        referencedRelation: "organisations";
                        referencedColumns: ["id"];
                    }
                ];
            };
            grade_appeals: {
                Row: {
                    appeal_reason: string;
                    created_at: string | null;
                    final_score: number | null;
                    grading_record_id: string;
                    id: string;
                    original_score: number;
                    requested_score: number | null;
                    resolved_at: string | null;
                    reviewer_id: string | null;
                    reviewer_notes: string | null;
                    status: string | null;
                    student_id: string;
                    updated_at: string | null;
                };
                Insert: {
                    appeal_reason: string;
                    created_at?: string | null;
                    final_score?: number | null;
                    grading_record_id: string;
                    id?: string;
                    original_score: number;
                    requested_score?: number | null;
                    resolved_at?: string | null;
                    reviewer_id?: string | null;
                    reviewer_notes?: string | null;
                    status?: string | null;
                    student_id: string;
                    updated_at?: string | null;
                };
                Update: {
                    appeal_reason?: string;
                    created_at?: string | null;
                    final_score?: number | null;
                    grading_record_id?: string;
                    id?: string;
                    original_score?: number;
                    requested_score?: number | null;
                    resolved_at?: string | null;
                    reviewer_id?: string | null;
                    reviewer_notes?: string | null;
                    status?: string | null;
                    student_id?: string;
                    updated_at?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "grade_appeals_grading_record_id_fkey";
                        columns: ["grading_record_id"];
                        isOneToOne: false;
                        referencedRelation: "grading_records";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "grade_appeals_reviewer_id_fkey";
                        columns: ["reviewer_id"];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: ["user_id"];
                    },
                    {
                        foreignKeyName: "grade_appeals_student_id_fkey";
                        columns: ["student_id"];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: ["user_id"];
                    }
                ];
            };
            gradebook_settings: {
                Row: {
                    class_instance_id: string | null;
                    created_at: string;
                    id: string;
                    settings: Json;
                    updated_at: string;
                };
                Insert: {
                    class_instance_id?: string | null;
                    created_at?: string;
                    id?: string;
                    settings?: Json;
                    updated_at?: string;
                };
                Update: {
                    class_instance_id?: string | null;
                    created_at?: string;
                    id?: string;
                    settings?: Json;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "gradebook_settings_class_instance_id_fkey";
                        columns: ["class_instance_id"];
                        isOneToOne: true;
                        referencedRelation: "class_instances";
                        referencedColumns: ["id"];
                    }
                ];
            };
            grades: {
                Row: {
                    assignment_id: string | null;
                    class_instance_id: string | null;
                    created_at: string;
                    feedback: string | null;
                    graded_at: string | null;
                    graded_by: string | null;
                    id: string;
                    percentage: number | null;
                    points_earned: number | null;
                    status: Database["public"]["Enums"]["grade_status"];
                    student_id: string | null;
                    submitted_at: string | null;
                    updated_at: string;
                };
                Insert: {
                    assignment_id?: string | null;
                    class_instance_id?: string | null;
                    created_at?: string;
                    feedback?: string | null;
                    graded_at?: string | null;
                    graded_by?: string | null;
                    id?: string;
                    percentage?: number | null;
                    points_earned?: number | null;
                    status?: Database["public"]["Enums"]["grade_status"];
                    student_id?: string | null;
                    submitted_at?: string | null;
                    updated_at?: string;
                };
                Update: {
                    assignment_id?: string | null;
                    class_instance_id?: string | null;
                    created_at?: string;
                    feedback?: string | null;
                    graded_at?: string | null;
                    graded_by?: string | null;
                    id?: string;
                    percentage?: number | null;
                    points_earned?: number | null;
                    status?: Database["public"]["Enums"]["grade_status"];
                    student_id?: string | null;
                    submitted_at?: string | null;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "grades_assignment_id_fkey";
                        columns: ["assignment_id"];
                        isOneToOne: false;
                        referencedRelation: "assignments";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "grades_class_instance_id_fkey";
                        columns: ["class_instance_id"];
                        isOneToOne: false;
                        referencedRelation: "class_instances";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "grades_graded_by_fkey";
                        columns: ["graded_by"];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: ["user_id"];
                    },
                    {
                        foreignKeyName: "grades_student_id_fkey";
                        columns: ["student_id"];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: ["user_id"];
                    }
                ];
            };
            homeschool_family_info: {
                Row: {
                    id: string;
                    organisation_id: string;
                    organisation_unit_id: string;
                    family_name: string;
                    number_of_children: number | null;
                    settings: Json | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    organisation_id: string;
                    organisation_unit_id: string;
                    family_name: string;
                    number_of_children?: number | null;
                    settings?: Json | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    organisation_id?: string;
                    organisation_unit_id?: string;
                    family_name?: string;
                    number_of_children?: number | null;
                    settings?: Json | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "homeschool_family_info_organisation_id_fkey";
                        columns: ["organisation_id"];
                        isOneToOne: false;
                        referencedRelation: "organisations";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "homeschool_family_info_organisation_unit_id_fkey";
                        columns: ["organisation_unit_id"];
                        isOneToOne: false;
                        referencedRelation: "organisation_units";
                        referencedColumns: ["id"];
                    }
                ];
            };
            grading_calibration: {
                Row: {
                    actual_score: number;
                    calibration_round: number | null;
                    created_at: string | null;
                    deviation: number | null;
                    expected_score: number;
                    grader_id: string;
                    id: string;
                    notes: string | null;
                    rubric_id: string;
                    sample_response_id: string;
                };
                Insert: {
                    actual_score: number;
                    calibration_round?: number | null;
                    created_at?: string | null;
                    deviation?: number | null;
                    expected_score: number;
                    grader_id: string;
                    id?: string;
                    notes?: string | null;
                    rubric_id: string;
                    sample_response_id: string;
                };
                Update: {
                    actual_score?: number;
                    calibration_round?: number | null;
                    created_at?: string | null;
                    deviation?: number | null;
                    expected_score?: number;
                    grader_id?: string;
                    id?: string;
                    notes?: string | null;
                    rubric_id?: string;
                    sample_response_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "grading_calibration_grader_id_fkey";
                        columns: ["grader_id"];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: ["user_id"];
                    },
                    {
                        foreignKeyName: "grading_calibration_rubric_id_fkey";
                        columns: ["rubric_id"];
                        isOneToOne: false;
                        referencedRelation: "rubrics";
                        referencedColumns: ["id"];
                    }
                ];
            };
            grading_records: {
                Row: {
                    confidence_score: number | null;
                    created_at: string | null;
                    criterion_id: string | null;
                    feedback: string | null;
                    flags: string[] | null;
                    id: string;
                    max_points: number;
                    metadata: Json | null;
                    performance_level: string | null;
                    points_awarded: number;
                    response_id: string;
                    response_type: string;
                    session_id: string;
                    time_spent_seconds: number | null;
                    updated_at: string | null;
                };
                Insert: {
                    confidence_score?: number | null;
                    created_at?: string | null;
                    criterion_id?: string | null;
                    feedback?: string | null;
                    flags?: string[] | null;
                    id?: string;
                    max_points: number;
                    metadata?: Json | null;
                    performance_level?: string | null;
                    points_awarded: number;
                    response_id: string;
                    response_type: string;
                    session_id: string;
                    time_spent_seconds?: number | null;
                    updated_at?: string | null;
                };
                Update: {
                    confidence_score?: number | null;
                    created_at?: string | null;
                    criterion_id?: string | null;
                    feedback?: string | null;
                    flags?: string[] | null;
                    id?: string;
                    max_points?: number;
                    metadata?: Json | null;
                    performance_level?: string | null;
                    points_awarded?: number;
                    response_id?: string;
                    response_type?: string;
                    session_id?: string;
                    time_spent_seconds?: number | null;
                    updated_at?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "grading_records_criterion_id_fkey";
                        columns: ["criterion_id"];
                        isOneToOne: false;
                        referencedRelation: "rubric_criteria";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "grading_records_session_id_fkey";
                        columns: ["session_id"];
                        isOneToOne: false;
                        referencedRelation: "grading_sessions";
                        referencedColumns: ["id"];
                    }
                ];
            };
            grading_sessions: {
                Row: {
                    assessment_id: string;
                    assessment_type: Database["public"]["Enums"]["assessment_type"];
                    calibration_score: number | null;
                    completed_at: string | null;
                    created_at: string | null;
                    graded_responses: number | null;
                    grader_id: string;
                    grading_method: Database["public"]["Enums"]["grading_method"];
                    id: string;
                    metadata: Json | null;
                    rubric_id: string | null;
                    started_at: string | null;
                    total_responses: number | null;
                    updated_at: string | null;
                };
                Insert: {
                    assessment_id: string;
                    assessment_type: Database["public"]["Enums"]["assessment_type"];
                    calibration_score?: number | null;
                    completed_at?: string | null;
                    created_at?: string | null;
                    graded_responses?: number | null;
                    grader_id: string;
                    grading_method: Database["public"]["Enums"]["grading_method"];
                    id?: string;
                    metadata?: Json | null;
                    rubric_id?: string | null;
                    started_at?: string | null;
                    total_responses?: number | null;
                    updated_at?: string | null;
                };
                Update: {
                    assessment_id?: string;
                    assessment_type?: Database["public"]["Enums"]["assessment_type"];
                    calibration_score?: number | null;
                    completed_at?: string | null;
                    created_at?: string | null;
                    graded_responses?: number | null;
                    grader_id?: string;
                    grading_method?: Database["public"]["Enums"]["grading_method"];
                    id?: string;
                    metadata?: Json | null;
                    rubric_id?: string | null;
                    started_at?: string | null;
                    total_responses?: number | null;
                    updated_at?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "grading_sessions_grader_id_fkey";
                        columns: ["grader_id"];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: ["user_id"];
                    },
                    {
                        foreignKeyName: "grading_sessions_rubric_id_fkey";
                        columns: ["rubric_id"];
                        isOneToOne: false;
                        referencedRelation: "rubrics";
                        referencedColumns: ["id"];
                    }
                ];
            };
            invite_codes: {
                Row: {
                    code: string;
                    created_at: string;
                    created_by: string | null;
                    expires_at: string | null;
                    id: string;
                    organisation_id: string;
                    role: Database["public"]["Enums"]["user_role"];
                    updated_at: string;
                };
                Insert: {
                    code?: string;
                    created_at?: string;
                    created_by?: string | null;
                    expires_at?: string | null;
                    id?: string;
                    organisation_id: string;
                    role: Database["public"]["Enums"]["user_role"];
                    updated_at?: string;
                };
                Update: {
                    code?: string;
                    created_at?: string;
                    created_by?: string | null;
                    expires_at?: string | null;
                    id?: string;
                    organisation_id?: string;
                    role?: Database["public"]["Enums"]["user_role"];
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "invite_codes_created_by_fkey";
                        columns: ["created_by"];
                        isOneToOne: false;
                        referencedRelation: "members";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "invite_codes_organisation_id_fkey";
                        columns: ["organisation_id"];
                        isOneToOne: false;
                        referencedRelation: "organisations";
                        referencedColumns: ["id"];
                    }
                ];
            };
            knowledge_base_analyses: {
                Row: {
                    analysis_details: Json | null;
                    base_class_id: string | null;
                    content_depth: string | null;
                    created_at: string | null;
                    id: string;
                    organisation_id: string;
                    recommended_generation_mode: string | null;
                    subject_coverage: string[] | null;
                    total_chunks: number | null;
                    total_documents: number | null;
                    updated_at: string | null;
                    user_id: string | null;
                };
                Insert: {
                    analysis_details?: Json | null;
                    base_class_id?: string | null;
                    content_depth?: string | null;
                    created_at?: string | null;
                    id?: string;
                    organisation_id: string;
                    recommended_generation_mode?: string | null;
                    subject_coverage?: string[] | null;
                    total_chunks?: number | null;
                    total_documents?: number | null;
                    updated_at?: string | null;
                    user_id?: string | null;
                };
                Update: {
                    analysis_details?: Json | null;
                    base_class_id?: string | null;
                    content_depth?: string | null;
                    created_at?: string | null;
                    id?: string;
                    organisation_id?: string;
                    recommended_generation_mode?: string | null;
                    subject_coverage?: string[] | null;
                    total_chunks?: number | null;
                    total_documents?: number | null;
                    updated_at?: string | null;
                    user_id?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "knowledge_base_analyses_base_class_id_fkey";
                        columns: ["base_class_id"];
                        isOneToOne: false;
                        referencedRelation: "base_classes";
                        referencedColumns: ["id"];
                    }
                ];
            };
            lesson_media_assets: {
                Row: {
                    asset_type: string;
                    content: Json | null;
                    created_at: string | null;
                    created_by: string | null;
                    duration: number | null;
                    file_path: string | null;
                    file_url: string | null;
                    id: string;
                    lesson_id: string;
                    status: string;
                    svg_content: string | null;
                    title: string;
                    updated_at: string | null;
                };
                Insert: {
                    asset_type: string;
                    content?: Json | null;
                    created_at?: string | null;
                    created_by?: string | null;
                    duration?: number | null;
                    file_path?: string | null;
                    file_url?: string | null;
                    id?: string;
                    lesson_id: string;
                    status?: string;
                    svg_content?: string | null;
                    title: string;
                    updated_at?: string | null;
                };
                Update: {
                    asset_type?: string;
                    content?: Json | null;
                    created_at?: string | null;
                    created_by?: string | null;
                    duration?: number | null;
                    file_path?: string | null;
                    file_url?: string | null;
                    id?: string;
                    lesson_id?: string;
                    status?: string;
                    svg_content?: string | null;
                    title?: string;
                    updated_at?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "lesson_media_assets_lesson_id_fkey";
                        columns: ["lesson_id"];
                        isOneToOne: false;
                        referencedRelation: "lessons";
                        referencedColumns: ["id"];
                    }
                ];
            };
            lesson_section_versions: {
                Row: {
                    content: Json | null;
                    created_at: string;
                    creator_user_id: string | null;
                    id: string;
                    lesson_section_id: string;
                    version_number: number;
                };
                Insert: {
                    content?: Json | null;
                    created_at?: string;
                    creator_user_id?: string | null;
                    id?: string;
                    lesson_section_id: string;
                    version_number: number;
                };
                Update: {
                    content?: Json | null;
                    created_at?: string;
                    creator_user_id?: string | null;
                    id?: string;
                    lesson_section_id?: string;
                    version_number?: number;
                };
                Relationships: [
                    {
                        foreignKeyName: "lesson_section_versions_lesson_section_id_fkey";
                        columns: ["lesson_section_id"];
                        isOneToOne: false;
                        referencedRelation: "lesson_sections";
                        referencedColumns: ["id"];
                    }
                ];
            };
            lesson_sections: {
                Row: {
                    content: Json | null;
                    content_embedding: string | null;
                    created_at: string;
                    created_by: string | null;
                    id: string;
                    lesson_id: string;
                    media_url: string | null;
                    order_index: number;
                    section_type: string;
                    title: string;
                    updated_at: string;
                };
                Insert: {
                    content?: Json | null;
                    content_embedding?: string | null;
                    created_at?: string;
                    created_by?: string | null;
                    id?: string;
                    lesson_id: string;
                    media_url?: string | null;
                    order_index: number;
                    section_type: string;
                    title: string;
                    updated_at?: string;
                };
                Update: {
                    content?: Json | null;
                    content_embedding?: string | null;
                    created_at?: string;
                    created_by?: string | null;
                    id?: string;
                    lesson_id?: string;
                    media_url?: string | null;
                    order_index?: number;
                    section_type?: string;
                    title?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "lesson_sections_created_by_fkey";
                        columns: ["created_by"];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: ["user_id"];
                    },
                    {
                        foreignKeyName: "lesson_sections_lesson_id_fkey";
                        columns: ["lesson_id"];
                        isOneToOne: false;
                        referencedRelation: "lessons";
                        referencedColumns: ["id"];
                    }
                ];
            };
            lessons: {
                Row: {
                    banner_image: string | null;
                    base_class_id: string | null;
                    created_at: string;
                    created_by: string | null;
                    creator_user_id: string | null;
                    description: string | null;
                    estimated_time: number | null;
                    id: string;
                    level: string | null;
                    order_index: number;
                    path_id: string;
                    published: boolean | null;
                    teaching_outline_content: string | null;
                    teaching_outline_generated_at: string | null;
                    title: string;
                    updated_at: string;
                };
                Insert: {
                    banner_image?: string | null;
                    base_class_id?: string | null;
                    created_at?: string;
                    created_by?: string | null;
                    creator_user_id?: string | null;
                    description?: string | null;
                    estimated_time?: number | null;
                    id?: string;
                    level?: string | null;
                    order_index: number;
                    path_id: string;
                    published?: boolean | null;
                    teaching_outline_content?: string | null;
                    teaching_outline_generated_at?: string | null;
                    title: string;
                    updated_at?: string;
                };
                Update: {
                    banner_image?: string | null;
                    base_class_id?: string | null;
                    created_at?: string;
                    created_by?: string | null;
                    creator_user_id?: string | null;
                    description?: string | null;
                    estimated_time?: number | null;
                    id?: string;
                    level?: string | null;
                    order_index?: number;
                    path_id?: string;
                    published?: boolean | null;
                    teaching_outline_content?: string | null;
                    teaching_outline_generated_at?: string | null;
                    title?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "lessons_base_class_id_fkey";
                        columns: ["base_class_id"];
                        isOneToOne: false;
                        referencedRelation: "base_classes";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "lessons_created_by_fkey";
                        columns: ["created_by"];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: ["user_id"];
                    },
                    {
                        foreignKeyName: "lessons_path_id_fkey";
                        columns: ["path_id"];
                        isOneToOne: false;
                        referencedRelation: "paths";
                        referencedColumns: ["id"];
                    }
                ];
            };
            luna_conversations: {
                Row: {
                    created_at: string | null;
                    id: string;
                    is_archived: boolean | null;
                    is_pinned: boolean | null;
                    message_count: number | null;
                    metadata: Json | null;
                    persona: string;
                    summary: string | null;
                    tags: string[] | null;
                    title: string;
                    updated_at: string | null;
                    user_id: string;
                };
                Insert: {
                    created_at?: string | null;
                    id?: string;
                    is_archived?: boolean | null;
                    is_pinned?: boolean | null;
                    message_count?: number | null;
                    metadata?: Json | null;
                    persona?: string;
                    summary?: string | null;
                    tags?: string[] | null;
                    title?: string;
                    updated_at?: string | null;
                    user_id: string;
                };
                Update: {
                    created_at?: string | null;
                    id?: string;
                    is_archived?: boolean | null;
                    is_pinned?: boolean | null;
                    message_count?: number | null;
                    metadata?: Json | null;
                    persona?: string;
                    summary?: string | null;
                    tags?: string[] | null;
                    title?: string;
                    updated_at?: string | null;
                    user_id?: string;
                };
                Relationships: [];
            };
            luna_messages: {
                Row: {
                    action_buttons: Json | null;
                    citations: Json | null;
                    content: string;
                    conversation_id: string;
                    created_at: string | null;
                    edit_history: Json | null;
                    id: string;
                    is_outline: boolean | null;
                    metadata: Json | null;
                    outline_data: Json | null;
                    parent_message_id: string | null;
                    persona: string;
                    role: string;
                    updated_at: string | null;
                };
                Insert: {
                    action_buttons?: Json | null;
                    citations?: Json | null;
                    content: string;
                    conversation_id: string;
                    created_at?: string | null;
                    edit_history?: Json | null;
                    id?: string;
                    is_outline?: boolean | null;
                    metadata?: Json | null;
                    outline_data?: Json | null;
                    parent_message_id?: string | null;
                    persona?: string;
                    role: string;
                    updated_at?: string | null;
                };
                Update: {
                    action_buttons?: Json | null;
                    citations?: Json | null;
                    content?: string;
                    conversation_id?: string;
                    created_at?: string | null;
                    edit_history?: Json | null;
                    id?: string;
                    is_outline?: boolean | null;
                    metadata?: Json | null;
                    outline_data?: Json | null;
                    parent_message_id?: string | null;
                    persona?: string;
                    role?: string;
                    updated_at?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "luna_messages_conversation_id_fkey";
                        columns: ["conversation_id"];
                        isOneToOne: false;
                        referencedRelation: "luna_conversations";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "luna_messages_parent_message_id_fkey";
                        columns: ["parent_message_id"];
                        isOneToOne: false;
                        referencedRelation: "luna_messages";
                        referencedColumns: ["id"];
                    }
                ];
            };
            members: {
                Row: {
                    created_at: string;
                    email: string | null;
                    first_name: string | null;
                    grade_level: string | null;
                    id: string;
                    last_name: string | null;
                    organisation_id: string | null;
                    role: Database["public"]["Enums"]["user_role"];
                    settings: Json | null;
                    updated_at: string;
                    username: string | null;
                };
                Insert: {
                    created_at?: string;
                    email?: string | null;
                    first_name?: string | null;
                    grade_level?: string | null;
                    id: string;
                    last_name?: string | null;
                    organisation_id?: string | null;
                    role: Database["public"]["Enums"]["user_role"];
                    settings?: Json | null;
                    updated_at?: string;
                    username?: string | null;
                };
                Update: {
                    created_at?: string;
                    email?: string | null;
                    first_name?: string | null;
                    grade_level?: string | null;
                    id?: string;
                    last_name?: string | null;
                    organisation_id?: string | null;
                    role?: Database["public"]["Enums"]["user_role"];
                    settings?: Json | null;
                    updated_at?: string;
                    username?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "members_organisation_id_fkey";
                        columns: ["organisation_id"];
                        isOneToOne: false;
                        referencedRelation: "organisations";
                        referencedColumns: ["id"];
                    }
                ];
            };
            organisation_units: {
                Row: {
                    created_at: string;
                    id: string;
                    name: string;
                    organisation_id: string | null;
                    unit_type: string | null;
                    settings: Json | null;
                    updated_at: string;
                };
                Insert: {
                    created_at?: string;
                    id?: string;
                    name: string;
                    organisation_id?: string | null;
                    unit_type?: string | null;
                    settings?: Json | null;
                    updated_at?: string;
                };
                Update: {
                    created_at?: string;
                    id?: string;
                    name?: string;
                    organisation_id?: string | null;
                    unit_type?: string | null;
                    settings?: Json | null;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "organisation_units_organisation_id_fkey";
                        columns: ["organisation_id"];
                        isOneToOne: false;
                        referencedRelation: "organisations";
                        referencedColumns: ["id"];
                    }
                ];
            };
            organisations: {
                Row: {
                    abbr: string | null;
                    abbreviation: string | null;
                    created_at: string;
                    id: string;
                    name: string;
                    organisation_type: string | null;
                    settings: Json | null;
                    updated_at: string;
                };
                Insert: {
                    abbr?: string | null;
                    abbreviation?: string | null;
                    created_at?: string;
                    id?: string;
                    name: string;
                    organisation_type?: string | null;
                    settings?: Json | null;
                    updated_at?: string;
                };
                Update: {
                    abbr?: string | null;
                    abbreviation?: string | null;
                    created_at?: string;
                    id?: string;
                    name?: string;
                    organisation_type?: string | null;
                    settings?: Json | null;
                    updated_at?: string;
                };
                Relationships: [];
            };
            password_reset_requests: {
                Row: {
                    created_at: string;
                    email: string;
                    expires_at: string;
                    fulfilled_at: string | null;
                    id: string;
                    reset_token: string;
                };
                Insert: {
                    created_at?: string;
                    email: string;
                    expires_at: string;
                    fulfilled_at?: string | null;
                    id?: string;
                    reset_token: string;
                };
                Update: {
                    created_at?: string;
                    email?: string;
                    expires_at?: string;
                    fulfilled_at?: string | null;
                    id?: string;
                    reset_token?: string;
                };
                Relationships: [];
            };
            paths: {
                Row: {
                    banner_image: string | null;
                    base_class_id: string | null;
                    created_at: string;
                    created_by: string | null;
                    creator_user_id: string | null;
                    description: string | null;
                    id: string;
                    level: string | null;
                    order_index: number | null;
                    organisation_id: string;
                    published: boolean | null;
                    title: string;
                    updated_at: string;
                };
                Insert: {
                    banner_image?: string | null;
                    base_class_id?: string | null;
                    created_at?: string;
                    created_by?: string | null;
                    creator_user_id?: string | null;
                    description?: string | null;
                    id?: string;
                    level?: string | null;
                    order_index?: number | null;
                    organisation_id: string;
                    published?: boolean | null;
                    title: string;
                    updated_at?: string;
                };
                Update: {
                    banner_image?: string | null;
                    base_class_id?: string | null;
                    created_at?: string;
                    created_by?: string | null;
                    creator_user_id?: string | null;
                    description?: string | null;
                    id?: string;
                    level?: string | null;
                    order_index?: number | null;
                    organisation_id?: string;
                    published?: boolean | null;
                    title?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "paths_base_class_id_fkey";
                        columns: ["base_class_id"];
                        isOneToOne: false;
                        referencedRelation: "base_classes";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "paths_created_by_fkey";
                        columns: ["created_by"];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: ["user_id"];
                    },
                    {
                        foreignKeyName: "paths_organisation_id_fkey";
                        columns: ["organisation_id"];
                        isOneToOne: false;
                        referencedRelation: "organisations";
                        referencedColumns: ["id"];
                    }
                ];
            };
            process_analytics: {
                Row: {
                    assessment_session_id: string;
                    client_timestamp: string | null;
                    element_id: string | null;
                    element_type: string | null;
                    event_data: Json | null;
                    event_type: string;
                    id: string;
                    question_id: string | null;
                    timestamp: string;
                    x_coordinate: number | null;
                    y_coordinate: number | null;
                };
                Insert: {
                    assessment_session_id: string;
                    client_timestamp?: string | null;
                    element_id?: string | null;
                    element_type?: string | null;
                    event_data?: Json | null;
                    event_type: string;
                    id?: string;
                    question_id?: string | null;
                    timestamp?: string;
                    x_coordinate?: number | null;
                    y_coordinate?: number | null;
                };
                Update: {
                    assessment_session_id?: string;
                    client_timestamp?: string | null;
                    element_id?: string | null;
                    element_type?: string | null;
                    event_data?: Json | null;
                    event_type?: string;
                    id?: string;
                    question_id?: string | null;
                    timestamp?: string;
                    x_coordinate?: number | null;
                    y_coordinate?: number | null;
                };
                Relationships: [];
            };
            proctoring_events: {
                Row: {
                    action_taken: string | null;
                    assessment_session_id: string;
                    auto_detected: boolean | null;
                    description: string | null;
                    event_data: Json | null;
                    event_type: string;
                    id: string;
                    reviewed: boolean | null;
                    reviewed_at: string | null;
                    reviewed_by: string | null;
                    severity: string | null;
                    timestamp: string;
                };
                Insert: {
                    action_taken?: string | null;
                    assessment_session_id: string;
                    auto_detected?: boolean | null;
                    description?: string | null;
                    event_data?: Json | null;
                    event_type: string;
                    id?: string;
                    reviewed?: boolean | null;
                    reviewed_at?: string | null;
                    reviewed_by?: string | null;
                    severity?: string | null;
                    timestamp?: string;
                };
                Update: {
                    action_taken?: string | null;
                    assessment_session_id?: string;
                    auto_detected?: boolean | null;
                    description?: string | null;
                    event_data?: Json | null;
                    event_type?: string;
                    id?: string;
                    reviewed?: boolean | null;
                    reviewed_at?: string | null;
                    reviewed_by?: string | null;
                    severity?: string | null;
                    timestamp?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "proctoring_events_reviewed_by_fkey";
                        columns: ["reviewed_by"];
                        isOneToOne: false;
                        referencedRelation: "members";
                        referencedColumns: ["id"];
                    }
                ];
            };
            profiles: {
                Row: {
                    active_role: Database["public"]["Enums"]["role"] | null;
                    additional_roles: Json | null;
                    created_at: string;
                    first_name: string | null;
                    grade_level: string | null;
                    last_name: string | null;
                    organisation_id: string | null;
                    organisation_unit_id: string | null;
                    role: Database["public"]["Enums"]["role"];
                    settings: Json | null;
                    survey_completed: boolean | null;
                    updated_at: string;
                    user_id: string;
                    username: string;
                };
                Insert: {
                    active_role?: Database["public"]["Enums"]["role"] | null;
                    additional_roles?: Json | null;
                    created_at?: string;
                    first_name?: string | null;
                    grade_level?: string | null;
                    last_name?: string | null;
                    organisation_id?: string | null;
                    organisation_unit_id?: string | null;
                    role: Database["public"]["Enums"]["role"];
                    settings?: Json | null;
                    survey_completed?: boolean | null;
                    updated_at?: string;
                    user_id: string;
                    username: string;
                };
                Update: {
                    active_role?: Database["public"]["Enums"]["role"] | null;
                    additional_roles?: Json | null;
                    created_at?: string;
                    first_name?: string | null;
                    grade_level?: string | null;
                    last_name?: string | null;
                    organisation_id?: string | null;
                    organisation_unit_id?: string | null;
                    role?: Database["public"]["Enums"]["role"];
                    settings?: Json | null;
                    survey_completed?: boolean | null;
                    updated_at?: string;
                    user_id?: string;
                    username?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "profiles_organisation_id_fkey";
                        columns: ["organisation_id"];
                        isOneToOne: false;
                        referencedRelation: "organisations";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "profiles_organisation_unit_id_fkey";
                        columns: ["organisation_unit_id"];
                        isOneToOne: false;
                        referencedRelation: "organisation_units";
                        referencedColumns: ["id"];
                    }
                ];
            };
            progress: {
                Row: {
                    created_at: string;
                    id: string;
                    item_id: string;
                    item_type: string;
                    last_position: string | null;
                    progress_percentage: number | null;
                    status: string;
                    updated_at: string;
                    user_id: string;
                };
                Insert: {
                    created_at?: string;
                    id?: string;
                    item_id: string;
                    item_type: string;
                    last_position?: string | null;
                    progress_percentage?: number | null;
                    status: string;
                    updated_at?: string;
                    user_id: string;
                };
                Update: {
                    created_at?: string;
                    id?: string;
                    item_id?: string;
                    item_type?: string;
                    last_position?: string | null;
                    progress_percentage?: number | null;
                    status?: string;
                    updated_at?: string;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "progress_user_id_fkey";
                        columns: ["user_id"];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: ["user_id"];
                    }
                ];
            };
            rosters: {
                Row: {
                    class_instance_id: string;
                    created_at: string;
                    id: string;
                    joined_at: string;
                    profile_id: string;
                    role: Database["public"]["Enums"]["user_role"];
                    settings: Json | null;
                    updated_at: string;
                };
                Insert: {
                    class_instance_id: string;
                    created_at?: string;
                    id?: string;
                    joined_at?: string;
                    profile_id: string;
                    role: Database["public"]["Enums"]["user_role"];
                    settings?: Json | null;
                    updated_at?: string;
                };
                Update: {
                    class_instance_id?: string;
                    created_at?: string;
                    id?: string;
                    joined_at?: string;
                    profile_id?: string;
                    role?: Database["public"]["Enums"]["user_role"];
                    settings?: Json | null;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "rosters_class_instance_id_fkey";
                        columns: ["class_instance_id"];
                        isOneToOne: false;
                        referencedRelation: "class_instances";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "rosters_profile_id_fkey";
                        columns: ["profile_id"];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: ["user_id"];
                    }
                ];
            };
            rubric_criteria: {
                Row: {
                    created_at: string | null;
                    description: string | null;
                    id: string;
                    max_points: number;
                    name: string;
                    order_index: number | null;
                    performance_levels: Json;
                    rubric_id: string;
                    updated_at: string | null;
                    weight: number | null;
                };
                Insert: {
                    created_at?: string | null;
                    description?: string | null;
                    id?: string;
                    max_points?: number;
                    name: string;
                    order_index?: number | null;
                    performance_levels: Json;
                    rubric_id: string;
                    updated_at?: string | null;
                    weight?: number | null;
                };
                Update: {
                    created_at?: string | null;
                    description?: string | null;
                    id?: string;
                    max_points?: number;
                    name?: string;
                    order_index?: number | null;
                    performance_levels?: Json;
                    rubric_id?: string;
                    updated_at?: string | null;
                    weight?: number | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "rubric_criteria_rubric_id_fkey";
                        columns: ["rubric_id"];
                        isOneToOne: false;
                        referencedRelation: "rubrics";
                        referencedColumns: ["id"];
                    }
                ];
            };
            rubrics: {
                Row: {
                    base_class_id: string | null;
                    created_at: string;
                    created_by: string | null;
                    criteria: Json;
                    description: string | null;
                    grading_scale: Database["public"]["Enums"]["grading_scale_type"] | null;
                    id: string;
                    is_template: boolean | null;
                    name: string;
                    parent_rubric_id: string | null;
                    rubric_type: Database["public"]["Enums"]["criterion_type"] | null;
                    scale_definition: Json | null;
                    tags: string[] | null;
                    total_points: number;
                    updated_at: string;
                    version: number | null;
                };
                Insert: {
                    base_class_id?: string | null;
                    created_at?: string;
                    created_by?: string | null;
                    criteria?: Json;
                    description?: string | null;
                    grading_scale?: Database["public"]["Enums"]["grading_scale_type"] | null;
                    id?: string;
                    is_template?: boolean | null;
                    name: string;
                    parent_rubric_id?: string | null;
                    rubric_type?: Database["public"]["Enums"]["criterion_type"] | null;
                    scale_definition?: Json | null;
                    tags?: string[] | null;
                    total_points?: number;
                    updated_at?: string;
                    version?: number | null;
                };
                Update: {
                    base_class_id?: string | null;
                    created_at?: string;
                    created_by?: string | null;
                    criteria?: Json;
                    description?: string | null;
                    grading_scale?: Database["public"]["Enums"]["grading_scale_type"] | null;
                    id?: string;
                    is_template?: boolean | null;
                    name?: string;
                    parent_rubric_id?: string | null;
                    rubric_type?: Database["public"]["Enums"]["criterion_type"] | null;
                    scale_definition?: Json | null;
                    tags?: string[] | null;
                    total_points?: number;
                    updated_at?: string;
                    version?: number | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "rubrics_base_class_id_fkey";
                        columns: ["base_class_id"];
                        isOneToOne: false;
                        referencedRelation: "base_classes";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "rubrics_created_by_fkey";
                        columns: ["created_by"];
                        isOneToOne: false;
                        referencedRelation: "members";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "rubrics_parent_rubric_id_fkey";
                        columns: ["parent_rubric_id"];
                        isOneToOne: false;
                        referencedRelation: "rubrics";
                        referencedColumns: ["id"];
                    }
                ];
            };
            simulation_states: {
                Row: {
                    assessment_session_id: string;
                    completion_percentage: number | null;
                    created_at: string;
                    current_state: Json;
                    id: string;
                    previous_states: Json | null;
                    simulation_data: Json | null;
                    simulation_type: string;
                    updated_at: string;
                    user_actions: Json | null;
                };
                Insert: {
                    assessment_session_id: string;
                    completion_percentage?: number | null;
                    created_at?: string;
                    current_state?: Json;
                    id?: string;
                    previous_states?: Json | null;
                    simulation_data?: Json | null;
                    simulation_type: string;
                    updated_at?: string;
                    user_actions?: Json | null;
                };
                Update: {
                    assessment_session_id?: string;
                    completion_percentage?: number | null;
                    created_at?: string;
                    current_state?: Json;
                    id?: string;
                    previous_states?: Json | null;
                    simulation_data?: Json | null;
                    simulation_type?: string;
                    updated_at?: string;
                    user_actions?: Json | null;
                };
                Relationships: [];
            };
            standards: {
                Row: {
                    category: string | null;
                    created_at: string;
                    created_by: string | null;
                    description: string | null;
                    id: string;
                    name: string;
                    organisation_id: string | null;
                    updated_at: string;
                };
                Insert: {
                    category?: string | null;
                    created_at?: string;
                    created_by?: string | null;
                    description?: string | null;
                    id?: string;
                    name: string;
                    organisation_id?: string | null;
                    updated_at?: string;
                };
                Update: {
                    category?: string | null;
                    created_at?: string;
                    created_by?: string | null;
                    description?: string | null;
                    id?: string;
                    name?: string;
                    organisation_id?: string | null;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "standards_created_by_fkey";
                        columns: ["created_by"];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: ["user_id"];
                    },
                    {
                        foreignKeyName: "standards_organisation_id_fkey";
                        columns: ["organisation_id"];
                        isOneToOne: false;
                        referencedRelation: "organisations";
                        referencedColumns: ["id"];
                    }
                ];
            };
            student_attempts: {
                Row: {
                    ai_feedback: string | null;
                    ai_graded_at: string | null;
                    ai_grading_status: string | null;
                    assessment_id: string;
                    attempt_number: number;
                    created_at: string | null;
                    earned_points: number | null;
                    id: string;
                    instructor_feedback: string | null;
                    manual_review_required: boolean | null;
                    manually_graded_at: string | null;
                    manually_graded_by: string | null;
                    passed: boolean | null;
                    percentage_score: number | null;
                    started_at: string | null;
                    status: string;
                    student_id: string;
                    submitted_at: string | null;
                    time_spent_minutes: number | null;
                    total_points: number | null;
                    updated_at: string | null;
                };
                Insert: {
                    ai_feedback?: string | null;
                    ai_graded_at?: string | null;
                    ai_grading_status?: string | null;
                    assessment_id: string;
                    attempt_number: number;
                    created_at?: string | null;
                    earned_points?: number | null;
                    id?: string;
                    instructor_feedback?: string | null;
                    manual_review_required?: boolean | null;
                    manually_graded_at?: string | null;
                    manually_graded_by?: string | null;
                    passed?: boolean | null;
                    percentage_score?: number | null;
                    started_at?: string | null;
                    status?: string;
                    student_id: string;
                    submitted_at?: string | null;
                    time_spent_minutes?: number | null;
                    total_points?: number | null;
                    updated_at?: string | null;
                };
                Update: {
                    ai_feedback?: string | null;
                    ai_graded_at?: string | null;
                    ai_grading_status?: string | null;
                    assessment_id?: string;
                    attempt_number?: number;
                    created_at?: string | null;
                    earned_points?: number | null;
                    id?: string;
                    instructor_feedback?: string | null;
                    manual_review_required?: boolean | null;
                    manually_graded_at?: string | null;
                    manually_graded_by?: string | null;
                    passed?: boolean | null;
                    percentage_score?: number | null;
                    started_at?: string | null;
                    status?: string;
                    student_id?: string;
                    submitted_at?: string | null;
                    time_spent_minutes?: number | null;
                    total_points?: number | null;
                    updated_at?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "student_attempts_assessment_id_fkey";
                        columns: ["assessment_id"];
                        isOneToOne: false;
                        referencedRelation: "assessments";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "student_attempts_manually_graded_by_fkey";
                        columns: ["manually_graded_by"];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: ["user_id"];
                    },
                    {
                        foreignKeyName: "student_attempts_student_id_fkey";
                        columns: ["student_id"];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: ["user_id"];
                    }
                ];
            };
            student_responses: {
                Row: {
                    ai_confidence: number | null;
                    ai_feedback: string | null;
                    ai_graded_at: string | null;
                    ai_score: number | null;
                    attempt_id: string;
                    created_at: string | null;
                    final_feedback: string | null;
                    final_score: number | null;
                    id: string;
                    is_correct: boolean | null;
                    manual_feedback: string | null;
                    manual_score: number | null;
                    manually_graded_at: string | null;
                    manually_graded_by: string | null;
                    override_reason: string | null;
                    points_earned: number | null;
                    question_id: string;
                    response_data: Json;
                    updated_at: string | null;
                };
                Insert: {
                    ai_confidence?: number | null;
                    ai_feedback?: string | null;
                    ai_graded_at?: string | null;
                    ai_score?: number | null;
                    attempt_id: string;
                    created_at?: string | null;
                    final_feedback?: string | null;
                    final_score?: number | null;
                    id?: string;
                    is_correct?: boolean | null;
                    manual_feedback?: string | null;
                    manual_score?: number | null;
                    manually_graded_at?: string | null;
                    manually_graded_by?: string | null;
                    override_reason?: string | null;
                    points_earned?: number | null;
                    question_id: string;
                    response_data: Json;
                    updated_at?: string | null;
                };
                Update: {
                    ai_confidence?: number | null;
                    ai_feedback?: string | null;
                    ai_graded_at?: string | null;
                    ai_score?: number | null;
                    attempt_id?: string;
                    created_at?: string | null;
                    final_feedback?: string | null;
                    final_score?: number | null;
                    id?: string;
                    is_correct?: boolean | null;
                    manual_feedback?: string | null;
                    manual_score?: number | null;
                    manually_graded_at?: string | null;
                    manually_graded_by?: string | null;
                    override_reason?: string | null;
                    points_earned?: number | null;
                    question_id?: string;
                    response_data?: Json;
                    updated_at?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "student_responses_attempt_id_fkey";
                        columns: ["attempt_id"];
                        isOneToOne: false;
                        referencedRelation: "student_attempts";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "student_responses_manually_graded_by_fkey";
                        columns: ["manually_graded_by"];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: ["user_id"];
                    },
                    {
                        foreignKeyName: "student_responses_question_id_fkey";
                        columns: ["question_id"];
                        isOneToOne: false;
                        referencedRelation: "assessment_questions";
                        referencedColumns: ["id"];
                    }
                ];
            };
            survey_question_responses: {
                Row: {
                    created_at: string | null;
                    id: number;
                    question_id: number | null;
                    response_text: string | null;
                    response_value: string | null;
                    survey_response_id: number | null;
                    updated_at: string | null;
                };
                Insert: {
                    created_at?: string | null;
                    id?: number;
                    question_id?: number | null;
                    response_text?: string | null;
                    response_value?: string | null;
                    survey_response_id?: number | null;
                    updated_at?: string | null;
                };
                Update: {
                    created_at?: string | null;
                    id?: number;
                    question_id?: number | null;
                    response_text?: string | null;
                    response_value?: string | null;
                    survey_response_id?: number | null;
                    updated_at?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "survey_question_responses_question_id_fkey";
                        columns: ["question_id"];
                        isOneToOne: false;
                        referencedRelation: "survey_questions";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "survey_question_responses_survey_response_id_fkey";
                        columns: ["survey_response_id"];
                        isOneToOne: false;
                        referencedRelation: "survey_responses";
                        referencedColumns: ["id"];
                    }
                ];
            };
            survey_questions: {
                Row: {
                    created_at: string | null;
                    id: number;
                    options: Json | null;
                    order_index: number;
                    question_text: string;
                    question_type: string;
                    required: boolean | null;
                    section_id: number | null;
                    updated_at: string | null;
                };
                Insert: {
                    created_at?: string | null;
                    id?: number;
                    options?: Json | null;
                    order_index: number;
                    question_text: string;
                    question_type: string;
                    required?: boolean | null;
                    section_id?: number | null;
                    updated_at?: string | null;
                };
                Update: {
                    created_at?: string | null;
                    id?: number;
                    options?: Json | null;
                    order_index?: number;
                    question_text?: string;
                    question_type?: string;
                    required?: boolean | null;
                    section_id?: number | null;
                    updated_at?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "survey_questions_section_id_fkey";
                        columns: ["section_id"];
                        isOneToOne: false;
                        referencedRelation: "survey_sections";
                        referencedColumns: ["id"];
                    }
                ];
            };
            survey_responses: {
                Row: {
                    completed_at: string | null;
                    created_at: string | null;
                    device_info: Json | null;
                    duration_seconds: number | null;
                    id: number;
                    updated_at: string | null;
                    user_id: string | null;
                };
                Insert: {
                    completed_at?: string | null;
                    created_at?: string | null;
                    device_info?: Json | null;
                    duration_seconds?: number | null;
                    id?: number;
                    updated_at?: string | null;
                    user_id?: string | null;
                };
                Update: {
                    completed_at?: string | null;
                    created_at?: string | null;
                    device_info?: Json | null;
                    duration_seconds?: number | null;
                    id?: number;
                    updated_at?: string | null;
                    user_id?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "survey_responses_user_id_fkey";
                        columns: ["user_id"];
                        isOneToOne: true;
                        referencedRelation: "profiles";
                        referencedColumns: ["user_id"];
                    }
                ];
            };
            survey_sections: {
                Row: {
                    created_at: string | null;
                    description: string | null;
                    id: number;
                    order_index: number;
                    title: string;
                    updated_at: string | null;
                };
                Insert: {
                    created_at?: string | null;
                    description?: string | null;
                    id?: number;
                    order_index: number;
                    title: string;
                    updated_at?: string | null;
                };
                Update: {
                    created_at?: string | null;
                    description?: string | null;
                    id?: number;
                    order_index?: number;
                    title?: string;
                    updated_at?: string | null;
                };
                Relationships: [];
            };
            teacher_tool_creations: {
                Row: {
                    content: Json;
                    created_at: string | null;
                    description: string | null;
                    id: string;
                    is_favorite: boolean | null;
                    metadata: Json | null;
                    tags: string[] | null;
                    title: string;
                    tool_id: string;
                    tool_name: string;
                    updated_at: string | null;
                    user_id: string;
                };
                Insert: {
                    content: Json;
                    created_at?: string | null;
                    description?: string | null;
                    id?: string;
                    is_favorite?: boolean | null;
                    metadata?: Json | null;
                    tags?: string[] | null;
                    title: string;
                    tool_id: string;
                    tool_name: string;
                    updated_at?: string | null;
                    user_id: string;
                };
                Update: {
                    content?: Json;
                    created_at?: string | null;
                    description?: string | null;
                    id?: string;
                    is_favorite?: boolean | null;
                    metadata?: Json | null;
                    tags?: string[] | null;
                    title?: string;
                    tool_id?: string;
                    tool_name?: string;
                    updated_at?: string | null;
                    user_id?: string;
                };
                Relationships: [];
            };
            user_analytics: {
                Row: {
                    assessment_id: string;
                    assessment_type: Database["public"]["Enums"]["assessment_type"];
                    attempts_count: number | null;
                    avg_improvement: number | null;
                    best_score: number | null;
                    created_at: string | null;
                    id: string;
                    last_activity_at: string | null;
                    latest_score: number | null;
                    learning_velocity: number | null;
                    mastery_level: number | null;
                    metadata: Json | null;
                    time_to_mastery: number | null;
                    updated_at: string | null;
                    user_id: string;
                };
                Insert: {
                    assessment_id: string;
                    assessment_type: Database["public"]["Enums"]["assessment_type"];
                    attempts_count?: number | null;
                    avg_improvement?: number | null;
                    best_score?: number | null;
                    created_at?: string | null;
                    id?: string;
                    last_activity_at?: string | null;
                    latest_score?: number | null;
                    learning_velocity?: number | null;
                    mastery_level?: number | null;
                    metadata?: Json | null;
                    time_to_mastery?: number | null;
                    updated_at?: string | null;
                    user_id: string;
                };
                Update: {
                    assessment_id?: string;
                    assessment_type?: Database["public"]["Enums"]["assessment_type"];
                    attempts_count?: number | null;
                    avg_improvement?: number | null;
                    best_score?: number | null;
                    created_at?: string | null;
                    id?: string;
                    last_activity_at?: string | null;
                    latest_score?: number | null;
                    learning_velocity?: number | null;
                    mastery_level?: number | null;
                    metadata?: Json | null;
                    time_to_mastery?: number | null;
                    updated_at?: string | null;
                    user_id?: string;
                };
                Relationships: [];
            };
            feedback_support: {
                Row: {
                    id: string;
                    user_id: string;
                    organisation_id: string | null;
                    category: "feedback" | "support" | "bug_report";
                    priority: "low" | "medium" | "high" | "critical";
                    subject: string;
                    message: string;
                    contact_email: string | null;
                    wants_followup: boolean | null;
                    current_page: string | null;
                    user_agent: string | null;
                    browser_info: Json | null;
                    status: "open" | "in_progress" | "resolved" | "closed";
                    created_at: string | null;
                    updated_at: string | null;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    organisation_id?: string | null;
                    category: "feedback" | "support" | "bug_report";
                    priority?: "low" | "medium" | "high" | "critical";
                    subject: string;
                    message: string;
                    contact_email?: string | null;
                    wants_followup?: boolean | null;
                    current_page?: string | null;
                    user_agent?: string | null;
                    browser_info?: Json | null;
                    status?: "open" | "in_progress" | "resolved" | "closed";
                    created_at?: string | null;
                    updated_at?: string | null;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    organisation_id?: string | null;
                    category?: "feedback" | "support" | "bug_report";
                    priority?: "low" | "medium" | "high" | "critical";
                    subject?: string;
                    message?: string;
                    contact_email?: string | null;
                    wants_followup?: boolean | null;
                    current_page?: string | null;
                    user_agent?: string | null;
                    browser_info?: Json | null;
                    status?: "open" | "in_progress" | "resolved" | "closed";
                    created_at?: string | null;
                    updated_at?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "feedback_support_user_id_fkey";
                        columns: ["user_id"];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: ["user_id"];
                    },
                    {
                        foreignKeyName: "feedback_support_organisation_id_fkey";
                        columns: ["organisation_id"];
                        isOneToOne: false;
                        referencedRelation: "organisations";
                        referencedColumns: ["id"];
                    }
                ];
            };
        };
        Views: {
            youtube_processing_analytics: {
                Row: {
                    channel_name: string | null;
                    created_at: string | null;
                    error_message: string | null;
                    error_type: string | null;
                    file_name: string | null;
                    file_type: string | null;
                    final_strategy_used: string | null;
                    id: string | null;
                    organisation_id: string | null;
                    processing_attempts: number | null;
                    processing_duration_seconds: number | null;
                    processing_outcome: string | null;
                    status: string | null;
                    strategies_tried: string | null;
                    transcript_languages_attempted: string | null;
                    updated_at: string | null;
                    user_guidance: string | null;
                    video_duration: string | null;
                    video_id: string | null;
                    video_title: string | null;
                };
                Insert: {
                    channel_name?: never;
                    created_at?: string | null;
                    error_message?: never;
                    error_type?: never;
                    file_name?: string | null;
                    file_type?: string | null;
                    final_strategy_used?: never;
                    id?: string | null;
                    organisation_id?: string | null;
                    processing_attempts?: never;
                    processing_duration_seconds?: never;
                    processing_outcome?: never;
                    status?: string | null;
                    strategies_tried?: never;
                    transcript_languages_attempted?: never;
                    updated_at?: string | null;
                    user_guidance?: never;
                    video_duration?: never;
                    video_id?: never;
                    video_title?: never;
                };
                Update: {
                    channel_name?: never;
                    created_at?: string | null;
                    error_message?: never;
                    error_type?: never;
                    file_name?: string | null;
                    file_type?: string | null;
                    final_strategy_used?: never;
                    id?: string | null;
                    organisation_id?: string | null;
                    processing_attempts?: never;
                    processing_duration_seconds?: never;
                    processing_outcome?: never;
                    status?: string | null;
                    strategies_tried?: never;
                    transcript_languages_attempted?: never;
                    updated_at?: string | null;
                    user_guidance?: never;
                    video_duration?: never;
                    video_id?: never;
                    video_title?: never;
                };
                Relationships: [
                    {
                        foreignKeyName: "documents_organisation_id_fkey";
                        columns: ["organisation_id"];
                        isOneToOne: false;
                        referencedRelation: "organisations";
                        referencedColumns: ["id"];
                    }
                ];
            };
        };
        Functions: {
            build_invite_code: {
                Args: {
                    _role: Database["public"]["Enums"]["role"];
                    _seq: number;
                    _abbr: string;
                    _student_seq?: number;
                };
                Returns: string;
            };
            calculate_attempt_score: {
                Args: {
                    attempt_uuid: string;
                };
                Returns: Json;
            };
            cleanup_old_realtime_updates: {
                Args: Record<PropertyKey, never>;
                Returns: undefined;
            };
            create_lesson_section_with_initial_version: {
                Args: {
                    p_lesson_id: string;
                    p_title: string;
                    p_content: Json;
                    p_order_index: number;
                    p_section_type: string;
                    p_creator_user_id: string;
                };
                Returns: {
                    content: Json | null;
                    content_embedding: string | null;
                    created_at: string;
                    created_by: string | null;
                    id: string;
                    lesson_id: string;
                    media_url: string | null;
                    order_index: number;
                    section_type: string;
                    title: string;
                    updated_at: string;
                }[];
            };
            disable_order_maintenance_trigger: {
                Args: {
                    table_name: string;
                };
                Returns: undefined;
            };
            enable_order_maintenance_trigger: {
                Args: {
                    table_name: string;
                };
                Returns: undefined;
            };
            enroll_student_in_class: {
                Args: {
                    p_enrollment_code: string;
                };
                Returns: {
                    success: boolean;
                    message: string;
                    class_instance_id: string;
                    class_instance_name: string;
                    enrollment_id: string;
                }[];
            };
            generate_password_reset_code: {
                Args: {
                    username: string;
                };
                Returns: string;
            };
            get_agent_session_context: {
                Args: {
                    session_uuid: string;
                };
                Returns: Json;
            };
            get_my_claims: {
                Args: Record<PropertyKey, never>;
                Returns: Json;
            };
            get_my_org_id: {
                Args: Record<PropertyKey, never>;
                Returns: string;
            };
            get_my_role: {
                Args: Record<PropertyKey, never>;
                Returns: string;
            };
            get_youtube_processing_summary: {
                Args: {
                    doc_id: string;
                };
                Returns: {
                    document_id: string;
                    current_status: string;
                    total_attempts: number;
                    strategies_attempted: string[];
                    last_error: string;
                    processing_duration_minutes: number;
                }[];
            };
            gtrgm_compress: {
                Args: {
                    "": unknown;
                };
                Returns: unknown;
            };
            gtrgm_decompress: {
                Args: {
                    "": unknown;
                };
                Returns: unknown;
            };
            gtrgm_in: {
                Args: {
                    "": unknown;
                };
                Returns: unknown;
            };
            gtrgm_options: {
                Args: {
                    "": unknown;
                };
                Returns: undefined;
            };
            gtrgm_out: {
                Args: {
                    "": unknown;
                };
                Returns: unknown;
            };
            is_class_teacher: {
                Args: {
                    instance_id: string;
                };
                Returns: boolean;
            };
            is_enrolled_in_base_class: {
                Args: {
                    class_id: string;
                };
                Returns: boolean;
            };
            is_enrolled_student: {
                Args: {
                    p_path_id: string;
                };
                Returns: boolean;
            };
            is_instructor_for_base_class: {
                Args: {
                    class_id: string;
                };
                Returns: boolean;
            };
            join_class_by_code: {
                Args: {
                    p_enrollment_code: string;
                };
                Returns: {
                    success: boolean;
                    message: string;
                    class_instance_id: string;
                    class_instance_name: string;
                    enrollment_id: string;
                }[];
            };
            log_youtube_processing_attempt: {
                Args: {
                    doc_id: string;
                    strategy_name: string;
                    attempt_result: string;
                    error_details?: Json;
                };
                Returns: undefined;
            };
            reorder_items_dynamically: {
                Args: {
                    p_table_name: string;
                    p_ids_array: string[];
                };
                Returns: undefined;
            };
            reorder_lesson_sections: {
                Args: {
                    _lesson_id: string;
                    _ordered_ids: string[];
                };
                Returns: undefined;
            };
            reorder_lessons: {
                Args: {
                    _path_id: string;
                    _ordered_ids: string[];
                };
                Returns: undefined;
            };
            reorder_paths: {
                Args: {
                    _base_class_id: string;
                    _ordered_ids: string[];
                };
                Returns: undefined;
            };
            reorder_sections: {
                Args: {
                    p_ids_array: string[];
                };
                Returns: undefined;
            };
            set_limit: {
                Args: {
                    "": number;
                };
                Returns: number;
            };
            show_limit: {
                Args: Record<PropertyKey, never>;
                Returns: number;
            };
            show_trgm: {
                Args: {
                    "": string;
                };
                Returns: string[];
            };
            update_agent_session_context: {
                Args: {
                    session_uuid: string;
                    new_context: Json;
                };
                Returns: undefined;
            };
            update_document_processing_metadata: {
                Args: {
                    doc_id: string;
                    new_status: string;
                    processing_info?: Json;
                };
                Returns: undefined;
            };
            update_order_for_ids: {
                Args: {
                    p_table_name: string;
                    p_id_column_name: string;
                    p_order_column_name: string;
                    p_ids_array: string[];
                };
                Returns: undefined;
            };
            upsert_progress: {
                Args: {
                    p_user_id: string;
                    p_item_type: string;
                    p_item_id: string;
                    p_status: string;
                    p_progress_percentage?: number;
                    p_last_position?: string;
                };
                Returns: string;
            };
            validate_question_answer_key: {
                Args: {
                    question_type_param: string;
                    answer_key_param: Json;
                };
                Returns: boolean;
            };
            vector_search: {
                Args: {
                    query_embedding: string;
                    organisation_id: string;
                    match_threshold?: number;
                    match_count?: number;
                };
                Returns: {
                    content: string;
                    metadata: Json;
                    chunk_index: number;
                    document_id: string;
                    file_name: string;
                    file_type: string;
                    document_metadata: Json;
                    similarity: number;
                }[];
            };
            vector_search_for_lesson_generation: {
                Args: {
                    query_embedding: string;
                    organisation_id: string;
                    base_class_id: string;
                    match_threshold?: number;
                    match_count?: number;
                };
                Returns: {
                    id: string;
                    content: string;
                    chunk_summary: string;
                    section_identifier: string;
                    section_summary: string;
                    citation_key: string;
                    metadata: Json;
                    chunk_index: number;
                    document_id: string;
                    file_name: string;
                    file_type: string;
                    document_metadata: Json;
                    similarity: number;
                    has_summary: boolean;
                    content_length: number;
                }[];
            };
            vector_search_with_base_class: {
                Args: {
                    query_embedding: string;
                    organisation_id: string;
                    base_class_id: string;
                    match_threshold?: number;
                    match_count?: number;
                };
                Returns: {
                    id: string;
                    content: string;
                    chunk_summary: string;
                    section_identifier: string;
                    section_summary: string;
                    citation_key: string;
                    metadata: Json;
                    chunk_index: number;
                    document_id: string;
                    file_name: string;
                    file_type: string;
                    document_metadata: Json;
                    similarity: number;
                }[];
            };
            insert_survey_response: {
                Args: {
                    p_user_id: string;
                    p_duration_seconds: number;
                    p_device_info: Json;
                    p_responses: Json;
                };
                Returns: number;
            };
            update_profile_survey_completed: {
                Args: {
                    p_user_id: string;
                };
                Returns: undefined;
            };
        };
        Enums: {
            assessment_type: "practice" | "lesson_quiz" | "path_exam" | "final_exam" | "diagnostic" | "benchmark";
            assignment_type: "quiz" | "homework" | "project" | "exam" | "discussion" | "lab" | "assignment";
            audit_action: "INSERT" | "UPDATE" | "DELETE";
            criterion_type: "holistic" | "analytic" | "checklist" | "rating_scale";
            document_status: "queued" | "processing" | "completed" | "error";
            grade_status: "graded" | "missing" | "late" | "excused" | "pending";
            grading_method: "automatic" | "manual" | "hybrid" | "peer_review" | "ai_assisted";
            grading_scale_type: "points" | "percentage" | "letter_grade" | "pass_fail" | "rubric_scale";
            mastery_level: "below" | "approaching" | "proficient" | "advanced";
            question_type: "multiple_choice" | "true_false" | "short_answer" | "long_answer" | "coding";
            role: "super_admin" | "admin" | "teacher" | "student" | "parent";
            user_role: "student" | "teacher" | "admin" | "super_admin" | "parent";
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
};
type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];
export type Tables<DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | {
    schema: keyof DatabaseWithoutInternals;
}, TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"]) : never = never> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
    Row: infer R;
} ? R : never : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
    Row: infer R;
} ? R : never : never;
export type TablesInsert<DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | {
    schema: keyof DatabaseWithoutInternals;
}, TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] : never = never> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Insert: infer I;
} ? I : never : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Insert: infer I;
} ? I : never : never;
export type TablesUpdate<DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | {
    schema: keyof DatabaseWithoutInternals;
}, TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] : never = never> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Update: infer U;
} ? U : never : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Update: infer U;
} ? U : never : never;
export type Enums<DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | {
    schema: keyof DatabaseWithoutInternals;
}, EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"] : never = never> = DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName] : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions] : never;
export type CompositeTypes<PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"] | {
    schema: keyof DatabaseWithoutInternals;
}, CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"] : never = never> = PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName] : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"] ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions] : never;
export declare const Constants: {
    readonly public: {
        readonly Enums: {
            readonly assessment_type: readonly ["practice", "lesson_quiz", "path_exam", "final_exam", "diagnostic", "benchmark"];
            readonly assignment_type: readonly ["quiz", "homework", "project", "exam", "discussion", "lab", "assignment"];
            readonly audit_action: readonly ["INSERT", "UPDATE", "DELETE"];
            readonly criterion_type: readonly ["holistic", "analytic", "checklist", "rating_scale"];
            readonly document_status: readonly ["queued", "processing", "completed", "error"];
            readonly grade_status: readonly ["graded", "missing", "late", "excused", "pending"];
            readonly grading_method: readonly ["automatic", "manual", "hybrid", "peer_review", "ai_assisted"];
            readonly grading_scale_type: readonly ["points", "percentage", "letter_grade", "pass_fail", "rubric_scale"];
            readonly mastery_level: readonly ["below", "approaching", "proficient", "advanced"];
            readonly question_type: readonly ["multiple_choice", "true_false", "short_answer", "long_answer", "coding"];
            readonly role: readonly ["super_admin", "admin", "teacher", "student", "parent"];
            readonly user_role: readonly ["student", "teacher", "admin", "super_admin", "parent"];
        };
    };
};
export {};
//# sourceMappingURL=db.d.ts.map