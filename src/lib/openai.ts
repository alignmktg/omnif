import OpenAI from 'openai';

export interface OpenAIClientOptions {
  headers?: Record<string, string>;
  agentRunId?: string;
  userId?: string;
}

export function createOpenAIClient(options: OpenAIClientOptions = {}): OpenAI {
  const heliconeEnabled = process.env.HELICONE_ENABLED === 'true';
  const heliconeApiKey = process.env.HELICONE_API_KEY;

  // Fallback API key for build time - will fail at runtime if actually used
  const apiKey = process.env.OPENAI_API_KEY || 'sk-build-time-placeholder';

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

export const openai = createOpenAIClient();
