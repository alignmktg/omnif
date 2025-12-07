import OpenAI from 'openai';
import { getModelParams, isGpt5Model, getGpt5Params, getAgentConfig } from '@/lib/config';

export interface OpenAIClientOptions {
  headers?: Record<string, string>;
  agentRunId?: string;
  userId?: string;
}

export interface AgentOpenAIClientOptions {
  agentRunId?: string;
  userId?: string;
}

export function createOpenAIClient(options: OpenAIClientOptions = {}): OpenAI {
  const heliconeEnabled = process.env.HELICONE_ENABLED === 'true';
  const heliconeApiKey = process.env.HELICONE_API_KEY;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  const config: ConstructorParameters<typeof OpenAI>[0] = {
    apiKey,
  };

  if (heliconeEnabled && heliconeApiKey) {
    config.baseURL = 'https://oai.helicone.ai/v1';
    config.defaultHeaders = {
      'Helicone-Auth': `Bearer ${heliconeApiKey}`,
      ...(options.agentRunId && {
        'Helicone-Property-AgentRunId': options.agentRunId,
      }),
      ...(options.userId && {
        'Helicone-User-Id': options.userId,
      }),
      ...options.headers,
    };
  } else if (options.headers) {
    config.defaultHeaders = options.headers;
  }

  return new OpenAI(config);
}

/**
 * Creates an OpenAI client configured for a specific agent
 * Uses agent-specific model config from pof.config.yaml
 */
export function createAgentOpenAIClient(
  agentName: 'research' | 'writer' | 'planner' | 'integrations',
  options: AgentOpenAIClientOptions = {}
): OpenAI {
  // Get agent config to ensure it's loaded, but use standard client creation
  // Model params will be retrieved via buildChatCompletionParams
  getAgentConfig(agentName);

  return createOpenAIClient({
    agentRunId: options.agentRunId,
    userId: options.userId,
  });
}

/**
 * Builds chat completion parameters based on model type
 * For GPT-5 models: returns reasoning_effort, verbosity, max_output_tokens
 * For other models: returns temperature, max_tokens, top_p
 */
export function buildChatCompletionParams(agentName?: 'research' | 'writer' | 'planner' | 'integrations'): {
  model: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  reasoning_effort?: string;
  verbosity?: string;
  max_output_tokens?: number;
} {
  return getModelParams(agentName);
}

// Lazy singleton - only created on first use at runtime
let _openaiClient: OpenAI | null = null;
export function getOpenAIClient(): OpenAI {
  if (!_openaiClient) {
    _openaiClient = createOpenAIClient();
  }
  return _openaiClient;
}

// Legacy export for backwards compatibility
export const openai = new Proxy({} as OpenAI, {
  get(_, prop) {
    const client = getOpenAIClient();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});
