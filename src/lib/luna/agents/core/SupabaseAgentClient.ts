import { createClient } from '@supabase/supabase-js';
import { Database } from '@/packages/types/db';

export interface AgentContext {
  userId: string;
  orgId: string;
  role: string;
  sessionId: string;
  agentName: string;
}

export interface AgentAnalytics {
  agent_name: string;
  action_type: string;
  user_id: string;
  organisation_id: string;
  session_id: string;
  input_tokens?: number;
  output_tokens?: number;
  execution_time_ms?: number;
  success: boolean;
  error_message?: string;
  metadata?: Record<string, any>;
}

export class SupabaseAgentClient {
  private supabase: ReturnType<typeof createClient<Database>>;
  
  constructor(serviceKey?: string) {
    // Use service key for agent operations (broader permissions)
    this.supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey || process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }

  // Content Management Operations
  async getBaseClass(id: string, agentContext?: AgentContext) {
    const startTime = Date.now();
    try {
      const { data, error } = await this.supabase
        .from('base_classes')
        .select(`
          *,
          paths:paths(
            *,
            lessons:lessons(
              *,
              sections:lesson_sections(*)
            )
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw new Error(`Failed to fetch base class: ${error.message}`);
      
      if (agentContext) {
        await this.logAgentAnalytics({
          agent_name: agentContext.agentName,
          action_type: 'get_base_class',
          user_id: agentContext.userId,
          organisation_id: agentContext.orgId,
          session_id: agentContext.sessionId,
          execution_time_ms: Date.now() - startTime,
          success: true,
          metadata: { base_class_id: id }
        });
      }

      return data;
    } catch (error) {
      if (agentContext) {
        await this.logAgentAnalytics({
          agent_name: agentContext.agentName,
          action_type: 'get_base_class',
          user_id: agentContext.userId,
          organisation_id: agentContext.orgId,
          session_id: agentContext.sessionId,
          execution_time_ms: Date.now() - startTime,
          success: false,
          error_message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      throw error;
    }
  }

  async createLessonSection(sectionData: any, agentContext: AgentContext) {
    const startTime = Date.now();
    try {
      const enrichedData = {
        ...sectionData,
        created_by_agent: true,
        agent_context: agentContext,
        created_at: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from('lesson_sections')
        .insert(enrichedData)
        .select()
        .single();

      if (error) throw new Error(`Failed to create lesson section: ${error.message}`);
      
      await this.logAgentAction('create', 'lesson_sections', data.id, agentContext);
      await this.logAgentAnalytics({
        agent_name: agentContext.agentName,
        action_type: 'create_lesson_section',
        user_id: agentContext.userId,
        organisation_id: agentContext.orgId,
        session_id: agentContext.sessionId,
        execution_time_ms: Date.now() - startTime,
        success: true,
        metadata: { section_id: data.id, lesson_id: sectionData.lesson_id }
      });

      return data;
    } catch (error) {
      await this.logAgentAnalytics({
        agent_name: agentContext.agentName,
        action_type: 'create_lesson_section',
        user_id: agentContext.userId,
        organisation_id: agentContext.orgId,
        session_id: agentContext.sessionId,
        execution_time_ms: Date.now() - startTime,
        success: false,
        error_message: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async updateContent(table: string, id: string, updates: any, agentContext: AgentContext) {
    const startTime = Date.now();
    try {
      const { data, error } = await this.supabase
        .from(table)
        .update({
          ...updates,
          updated_by_agent: true,
          agent_context: agentContext,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(`Failed to update ${table}: ${error.message}`);
      
      await this.logAgentAction('update', table, id, agentContext);
      await this.logAgentAnalytics({
        agent_name: agentContext.agentName,
        action_type: `update_${table}`,
        user_id: agentContext.userId,
        organisation_id: agentContext.orgId,
        session_id: agentContext.sessionId,
        execution_time_ms: Date.now() - startTime,
        success: true,
        metadata: { record_id: id, table }
      });

      return data;
    } catch (error) {
      await this.logAgentAnalytics({
        agent_name: agentContext.agentName,
        action_type: `update_${table}`,
        user_id: agentContext.userId,
        organisation_id: agentContext.orgId,
        session_id: agentContext.sessionId,
        execution_time_ms: Date.now() - startTime,
        success: false,
        error_message: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Knowledge Base Operations
  async searchKnowledgeBase(query: string, filters?: { baseClassId?: string; orgId: string }, agentContext?: AgentContext) {
    const startTime = Date.now();
    try {
      const embedding = await this.generateEmbedding(query);
      
      let queryBuilder = this.supabase
        .from('chunks')
        .select(`
          *,
          documents:documents(
            title,
            file_type,
            base_class_id
          )
        `)
        .order('embedding <-> `[${embedding.join(',')}]`' as any)
        .limit(10);

      if (filters?.baseClassId) {
        queryBuilder = queryBuilder.eq('documents.base_class_id', filters.baseClassId);
      }

      const { data, error } = await queryBuilder;
      if (error) throw new Error(`Knowledge base search failed: ${error.message}`);
      
      if (agentContext) {
        await this.logAgentAnalytics({
          agent_name: agentContext.agentName,
          action_type: 'search_knowledge_base',
          user_id: agentContext.userId,
          organisation_id: agentContext.orgId,
          session_id: agentContext.sessionId,
          execution_time_ms: Date.now() - startTime,
          success: true,
          metadata: { query, results_count: data?.length || 0 }
        });
      }
      
      return data;
    } catch (error) {
      if (agentContext) {
        await this.logAgentAnalytics({
          agent_name: agentContext.agentName,
          action_type: 'search_knowledge_base',
          user_id: agentContext.userId,
          organisation_id: agentContext.orgId,
          session_id: agentContext.sessionId,
          execution_time_ms: Date.now() - startTime,
          success: false,
          error_message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      throw error;
    }
  }

  // User and Organization Context
  async getUserProfile(userId: string, agentContext?: AgentContext) {
    const startTime = Date.now();
    try {
      const { data, error } = await this.supabase
        .from('members')
        .select(`
          *,
          organisation:organisations(*)
        `)
        .eq('auth_id', userId)
        .single();

      if (error) throw new Error(`Failed to fetch user profile: ${error.message}`);
      
      if (agentContext) {
        await this.logAgentAnalytics({
          agent_name: agentContext.agentName,
          action_type: 'get_user_profile',
          user_id: agentContext.userId,
          organisation_id: agentContext.orgId,
          session_id: agentContext.sessionId,
          execution_time_ms: Date.now() - startTime,
          success: true
        });
      }

      return data;
    } catch (error) {
      if (agentContext) {
        await this.logAgentAnalytics({
          agent_name: agentContext.agentName,
          action_type: 'get_user_profile',
          user_id: agentContext.userId,
          organisation_id: agentContext.orgId,
          session_id: agentContext.sessionId,
          execution_time_ms: Date.now() - startTime,
          success: false,
          error_message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      throw error;
    }
  }

  // Learning Progress and Analytics
  async getLearningProgress(userId: string, agentContext?: AgentContext) {
    const { data, error } = await this.supabase
      .from('submissions')
      .select(`
        *,
        quiz:quizzes(
          *,
          lesson:lessons(*)
        )
      `)
      .eq('member_id', userId)
      .order('submitted_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch learning progress: ${error.message}`);
    return data;
  }

  async recordAnalyticsEvent(eventData: any, agentContext?: AgentContext) {
    const { data, error } = await this.supabase
      .from('performance_analytics')
      .insert({
        ...eventData,
        computed_at: new Date().toISOString()
      });

    if (error) throw new Error(`Failed to record analytics event: ${error.message}`);
    return data;
  }

  // Storage Operations
  async uploadToStorage(bucket: string, fileName: string, fileData: Buffer, contentType: string, agentContext?: AgentContext) {
    const startTime = Date.now();
    try {
      const { data, error } = await this.supabase.storage
        .from(bucket)
        .upload(fileName, fileData, {
          contentType,
          upsert: true
        });

      if (error) throw new Error(`Upload failed: ${error.message}`);
      
      if (agentContext) {
        await this.logAgentAnalytics({
          agent_name: agentContext.agentName,
          action_type: 'upload_file',
          user_id: agentContext.userId,
          organisation_id: agentContext.orgId,
          session_id: agentContext.sessionId,
          execution_time_ms: Date.now() - startTime,
          success: true,
          metadata: { bucket, fileName, contentType }
        });
      }

      return data;
    } catch (error) {
      if (agentContext) {
        await this.logAgentAnalytics({
          agent_name: agentContext.agentName,
          action_type: 'upload_file',
          user_id: agentContext.userId,
          organisation_id: agentContext.orgId,
          session_id: agentContext.sessionId,
          execution_time_ms: Date.now() - startTime,
          success: false,
          error_message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      throw error;
    }
  }

  // Compliance and Audit Logging
  private async logAgentAction(action: string, table: string, recordId: string, context: AgentContext) {
    try {
      await this.supabase
        .from('audit_logs')
        .insert({
          table_name: table,
          record_id: recordId,
          action: `agent_${action}`,
          performed_by: context.userId,
          old_data: null,
          new_data: { agent_action: true, context },
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Failed to log agent action:', error);
    }
  }

  private async logAgentAnalytics(analyticsData: AgentAnalytics) {
    try {
      await this.supabase
        .from('agent_analytics')
        .insert({
          ...analyticsData,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Failed to log agent analytics:', error);
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text
      })
    });

    const result = await response.json();
    return result.data[0].embedding;
  }

  // Expose the supabase client for direct access when needed
  get client() {
    return this.supabase;
  }
}