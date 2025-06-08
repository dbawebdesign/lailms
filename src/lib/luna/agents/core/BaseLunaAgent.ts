import { Agent, RealtimeAgent } from '@openai/agents';
import { UniversalSupabaseTools } from '../tools/SupabaseTools';
import { AgentContext } from './SupabaseAgentClient';

// Default model configuration for all Luna agents
export const LUNA_DEFAULT_CONFIG = {
  model: 'gpt-4-turbo-2024-04-09', // GPT-4.1-mini equivalent
  temperature: 0.7,
  max_tokens: 4000,
  top_p: 0.95
} as const;

// Specialized model configurations for specific use cases
export const SPECIALIZED_MODELS = {
  // For complex reasoning tasks (course architecture, research synthesis)
  reasoning: {
    model: 'gpt-4o', 
    temperature: 0.3,
    max_tokens: 8000
  },
  // For creative content generation
  creative: {
    model: 'gpt-4-turbo-2024-04-09',
    temperature: 0.9,
    max_tokens: 4000
  },
  // For voice/realtime agents
  realtime: {
    model: 'gpt-4o-realtime-preview-2025-06-03'
  }
} as const;

export interface LunaAgentConfig {
  name: string;
  instructions: string;
  persona?: string;
  specialized?: boolean; // Use specialized model if true
  additionalTools?: any[];
  guardrails?: any[];
  handoffs?: Agent[];
  voice?: boolean; // Whether this is a voice agent
}

export class BaseLunaAgent extends Agent {
  protected supabaseTools: UniversalSupabaseTools;
  public readonly agentType: 'text' | 'voice' = 'text';

  constructor(config: LunaAgentConfig) {
    // Initialize Supabase tools
    const supabaseTools = new UniversalSupabaseTools();

    super({
      name: config.name,
      instructions: config.instructions,
      model: config.specialized ? 
        SPECIALIZED_MODELS.reasoning.model : 
        LUNA_DEFAULT_CONFIG.model,
      temperature: config.specialized ? 
        SPECIALIZED_MODELS.reasoning.temperature : 
        LUNA_DEFAULT_CONFIG.temperature,
      max_tokens: config.specialized ? 
        SPECIALIZED_MODELS.reasoning.max_tokens : 
        LUNA_DEFAULT_CONFIG.max_tokens,
      
      // All Luna agents get Supabase tools + any additional tools
      tools: [
        ...supabaseTools.getAllTools(),
        ...(config.additionalTools || [])
      ],
      
      guardrails: config.guardrails || [],
      handoffs: config.handoffs || []
    });

    this.supabaseTools = supabaseTools;
  }

  // Helper method to run with user context
  async runWithContext(input: string, userContext: AgentContext) {
    return this.run(input, {
      context: {
        ...userContext,
        agentName: this.name,
        timestamp: new Date().toISOString()
      }
    });
  }

  // Enhanced run method with automatic context injection
  async runEnhanced(input: string, context: {
    userId: string;
    orgId: string;
    role: string;
    sessionId: string;
    additionalContext?: any;
  }) {
    const agentContext: AgentContext = {
      userId: context.userId,
      orgId: context.orgId,
      role: context.role,
      sessionId: context.sessionId,
      agentName: this.name
    };

    return this.run(input, {
      context: {
        ...agentContext,
        ...context.additionalContext,
        timestamp: new Date().toISOString()
      }
    });
  }
}

export class BaseLunaRealtimeAgent extends RealtimeAgent {
  protected supabaseTools: UniversalSupabaseTools;
  public readonly agentType: 'text' | 'voice' = 'voice';

  constructor(config: LunaAgentConfig) {
    const supabaseTools = new UniversalSupabaseTools();

    super({
      name: config.name,
      instructions: config.instructions,
      model: SPECIALIZED_MODELS.realtime.model,
      
      tools: [
        ...supabaseTools.getAllTools(),
        ...(config.additionalTools || [])
      ],
      
      guardrails: config.guardrails || []
    });

    this.supabaseTools = supabaseTools;
  }

  // Voice-specific context method
  async runWithVoiceContext(input: string, userContext: AgentContext, audioContext?: any) {
    return this.run(input, {
      context: {
        ...userContext,
        agentName: this.name,
        audioContext,
        timestamp: new Date().toISOString()
      }
    });
  }
}

// Agent factory for creating agents with proper configuration
export class LunaAgentFactory {
  static createTextAgent(config: LunaAgentConfig): BaseLunaAgent {
    return new BaseLunaAgent(config);
  }

  static createVoiceAgent(config: LunaAgentConfig): BaseLunaRealtimeAgent {
    return new BaseLunaRealtimeAgent(config);
  }

  static createHybridAgent(config: LunaAgentConfig): {
    textAgent: BaseLunaAgent;
    voiceAgent: BaseLunaRealtimeAgent;
  } {
    return {
      textAgent: new BaseLunaAgent(config),
      voiceAgent: new BaseLunaRealtimeAgent(config)
    };
  }
}