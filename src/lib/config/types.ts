import { z } from 'zod';

// GPT-5 specific enums
export const GPT5ReasoningEffortSchema = z.enum(['minimal', 'low', 'medium', 'high']);
export type GPT5ReasoningEffort = z.infer<typeof GPT5ReasoningEffortSchema>;

export const GPT5VerbositySchema = z.enum(['low', 'medium', 'high']);
export type GPT5Verbosity = z.infer<typeof GPT5VerbositySchema>;

// Base AI model configuration (for non-GPT-5 models)
export const BaseAIModelConfigSchema = z.object({
  model: z.string(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().positive().optional(),
  top_p: z.number().min(0).max(1).optional(),
});
export type BaseAIModelConfig = z.infer<typeof BaseAIModelConfigSchema>;

// GPT-5 specific configuration
export const GPT5ModelConfigSchema = z.object({
  model: z.literal('gpt-5').or(z.literal('gpt-5-nano')),
  reasoning_effort: GPT5ReasoningEffortSchema.default('minimal'),
  verbosity: GPT5VerbositySchema.default('low'),
  max_output_tokens: z.number().positive().default(2000),
});
export type GPT5ModelConfig = z.infer<typeof GPT5ModelConfigSchema>;

// Union type for any AI model configuration
export const AIModelConfigSchema = z.union([
  BaseAIModelConfigSchema,
  GPT5ModelConfigSchema,
]);
export type AIModelConfig = z.infer<typeof AIModelConfigSchema>;

// Agent-specific configuration
export const AgentConfigSchema = z.object({
  enabled: z.boolean().default(true),
  model: AIModelConfigSchema,
  timeout_ms: z.number().positive().default(30000),
  max_retries: z.number().min(0).max(5).default(1),
  system_prompt: z.string().optional(),
});
export type AgentConfig = z.infer<typeof AgentConfigSchema>;

// Research agent configuration
export const ResearchAgentConfigSchema = AgentConfigSchema.extend({
  max_sources: z.number().positive().default(10),
  search_depth: z.enum(['shallow', 'medium', 'deep']).default('medium'),
});
export type ResearchAgentConfig = z.infer<typeof ResearchAgentConfigSchema>;

// Writer agent configuration
export const WriterAgentConfigSchema = AgentConfigSchema.extend({
  tone: z.enum(['formal', 'casual', 'technical', 'creative']).default('formal'),
  max_length: z.number().positive().optional(),
});
export type WriterAgentConfig = z.infer<typeof WriterAgentConfigSchema>;

// Planner agent configuration
export const PlannerAgentConfigSchema = AgentConfigSchema.extend({
  planning_horizon_days: z.number().positive().default(7),
  max_tasks_per_plan: z.number().positive().default(50),
});
export type PlannerAgentConfig = z.infer<typeof PlannerAgentConfigSchema>;

// Integrations agent configuration
export const IntegrationsAgentConfigSchema = AgentConfigSchema.extend({
  supported_integrations: z.array(z.string()).default(['email', 'calendar']),
});
export type IntegrationsAgentConfig = z.infer<typeof IntegrationsAgentConfigSchema>;

// Concierge orchestrator configuration
export const ConciergeConfigSchema = z.object({
  enabled: z.boolean().default(true),
  model: AIModelConfigSchema,
  timeout_ms: z.number().positive().default(30000),
  max_retries: z.number().min(0).max(5).default(1),
  system_prompt: z.string().optional(),
  target_latency_ms: z.number().positive().default(5000),
  max_concurrent_agents: z.number().positive().default(5),
  enable_streaming: z.boolean().default(true),
});
export type ConciergeConfig = z.infer<typeof ConciergeConfigSchema>;

// Feature flags
export const FeatureFlagsSchema = z.object({
  enable_knowledge_graph: z.boolean().default(false),
  enable_qa_layer: z.boolean().default(false),
  enable_crawler: z.boolean().default(false),
  enable_email_integration: z.boolean().default(false),
  enable_calendar_integration: z.boolean().default(false),
  enable_workflow_patterns: z.boolean().default(true),
  enable_multi_agent: z.boolean().default(true),
  enable_dag_validation: z.boolean().default(true),
});
export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;

// Environment profile
export const EnvironmentProfileSchema = z.enum(['development', 'production', 'test']);
export type EnvironmentProfile = z.infer<typeof EnvironmentProfileSchema>;

// Complete POF configuration
export const POFConfigSchema = z.object({
  environment: EnvironmentProfileSchema,

  // Core orchestrator
  concierge: ConciergeConfigSchema,

  // Sub-agents
  agents: z.object({
    research: ResearchAgentConfigSchema,
    writer: WriterAgentConfigSchema,
    planner: PlannerAgentConfigSchema,
    integrations: IntegrationsAgentConfigSchema,
  }),

  // Feature flags
  features: FeatureFlagsSchema,

  // Execution engine settings
  execution: z.object({
    max_parallel_tasks: z.number().positive().default(10),
    task_timeout_ms: z.number().positive().default(300000),
    enable_auto_retry: z.boolean().default(true),
  }).optional(),

  // Knowledge graph settings
  knowledge_graph: z.object({
    enabled: z.boolean().default(false),
    max_entities: z.number().positive().default(10000),
    similarity_threshold: z.number().min(0).max(1).default(0.7),
  }).optional(),

  // Logging and observability
  observability: z.object({
    log_level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    enable_tracing: z.boolean().default(false),
    enable_metrics: z.boolean().default(false),
    helicone_enabled: z.boolean().default(false),
  }).optional(),
});
export type POFConfig = z.infer<typeof POFConfigSchema>;

// Default configurations for different environments
export const defaultDevelopmentConfig: POFConfig = {
  environment: 'development',
  concierge: {
    enabled: true,
    model: {
      model: 'gpt-5-nano',
      reasoning_effort: 'minimal',
      verbosity: 'low',
      max_output_tokens: 2000,
    },
    timeout_ms: 30000,
    max_retries: 1,
    target_latency_ms: 5000,
    max_concurrent_agents: 5,
    enable_streaming: true,
  },
  agents: {
    research: {
      enabled: true,
      model: {
        model: 'gpt-5-nano',
        reasoning_effort: 'minimal',
        verbosity: 'low',
        max_output_tokens: 2000,
      },
      timeout_ms: 30000,
      max_retries: 1,
      max_sources: 10,
      search_depth: 'medium',
    },
    writer: {
      enabled: true,
      model: {
        model: 'gpt-5-nano',
        reasoning_effort: 'minimal',
        verbosity: 'low',
        max_output_tokens: 2000,
      },
      timeout_ms: 30000,
      max_retries: 1,
      tone: 'formal',
    },
    planner: {
      enabled: true,
      model: {
        model: 'gpt-5-nano',
        reasoning_effort: 'minimal',
        verbosity: 'low',
        max_output_tokens: 2000,
      },
      timeout_ms: 30000,
      max_retries: 1,
      planning_horizon_days: 7,
      max_tasks_per_plan: 50,
    },
    integrations: {
      enabled: true,
      model: {
        model: 'gpt-5-nano',
        reasoning_effort: 'minimal',
        verbosity: 'low',
        max_output_tokens: 2000,
      },
      timeout_ms: 30000,
      max_retries: 1,
      supported_integrations: ['email', 'calendar'],
    },
  },
  features: {
    enable_knowledge_graph: false,
    enable_qa_layer: false,
    enable_crawler: false,
    enable_email_integration: false,
    enable_calendar_integration: false,
    enable_workflow_patterns: true,
    enable_multi_agent: true,
    enable_dag_validation: true,
  },
  execution: {
    max_parallel_tasks: 10,
    task_timeout_ms: 300000,
    enable_auto_retry: true,
  },
  knowledge_graph: {
    enabled: false,
    max_entities: 10000,
    similarity_threshold: 0.7,
  },
  observability: {
    log_level: 'debug',
    enable_tracing: true,
    enable_metrics: true,
    helicone_enabled: false,
  },
};

export const defaultProductionConfig: POFConfig = {
  environment: 'production',
  concierge: {
    enabled: true,
    model: {
      model: 'gpt-5',
      reasoning_effort: 'medium',
      verbosity: 'low',
      max_output_tokens: 2000,
    },
    timeout_ms: 30000,
    max_retries: 2,
    target_latency_ms: 5000,
    max_concurrent_agents: 10,
    enable_streaming: true,
  },
  agents: {
    research: {
      enabled: true,
      model: {
        model: 'gpt-5',
        reasoning_effort: 'medium',
        verbosity: 'low',
        max_output_tokens: 2000,
      },
      timeout_ms: 60000,
      max_retries: 2,
      max_sources: 20,
      search_depth: 'deep',
    },
    writer: {
      enabled: true,
      model: {
        model: 'gpt-5',
        reasoning_effort: 'medium',
        verbosity: 'low',
        max_output_tokens: 2000,
      },
      timeout_ms: 60000,
      max_retries: 2,
      tone: 'formal',
    },
    planner: {
      enabled: true,
      model: {
        model: 'gpt-5',
        reasoning_effort: 'medium',
        verbosity: 'low',
        max_output_tokens: 2000,
      },
      timeout_ms: 60000,
      max_retries: 2,
      planning_horizon_days: 14,
      max_tasks_per_plan: 100,
    },
    integrations: {
      enabled: true,
      model: {
        model: 'gpt-5',
        reasoning_effort: 'low',
        verbosity: 'low',
        max_output_tokens: 2000,
      },
      timeout_ms: 60000,
      max_retries: 2,
      supported_integrations: ['email', 'calendar'],
    },
  },
  features: {
    enable_knowledge_graph: true,
    enable_qa_layer: true,
    enable_crawler: true,
    enable_email_integration: true,
    enable_calendar_integration: true,
    enable_workflow_patterns: true,
    enable_multi_agent: true,
    enable_dag_validation: true,
  },
  execution: {
    max_parallel_tasks: 20,
    task_timeout_ms: 600000,
    enable_auto_retry: true,
  },
  knowledge_graph: {
    enabled: true,
    max_entities: 100000,
    similarity_threshold: 0.75,
  },
  observability: {
    log_level: 'info',
    enable_tracing: true,
    enable_metrics: true,
    helicone_enabled: true,
  },
};
