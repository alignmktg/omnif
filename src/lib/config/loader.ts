import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import {
  POFConfigSchema,
  type POFConfig,
  type AgentConfig,
  type ConciergeConfig,
  type AIModelConfig,
  defaultDevelopmentConfig,
  defaultProductionConfig,
} from './types';

let cachedConfig: POFConfig | null = null;

/**
 * Loads and validates the POF configuration from pof.config.yaml
 * Supports environment profiles via NODE_ENV or POF_PROFILE
 * Returns default config if file doesn't exist
 */
export function getConfig(): POFConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  // Determine profile (development, production, test)
  const profile = process.env.POF_PROFILE || process.env.NODE_ENV || 'development';

  try {
    // Look for config file in project root
    const configPath = path.join(process.cwd(), 'pof.config.yaml');

    if (!fs.existsSync(configPath)) {
      console.warn('pof.config.yaml not found, using defaults');
      cachedConfig = getDefaultConfigForProfile(profile);
      return cachedConfig;
    }

    // Read and parse YAML
    const fileContents = fs.readFileSync(configPath, 'utf8');
    const rawConfig = yaml.parse(fileContents);

    // Merge profile-specific overrides with defaults
    let config = rawConfig.default || getDefaultConfigForProfile(profile);

    if (rawConfig.profiles && rawConfig.profiles[profile]) {
      config = deepMerge(config, rawConfig.profiles[profile]);
    }

    // Validate with Zod schema
    const validated = POFConfigSchema.parse(config);
    cachedConfig = validated;

    return cachedConfig;
  } catch (error) {
    console.error('Error loading config:', error);
    console.warn('Falling back to default config');
    cachedConfig = getDefaultConfigForProfile(profile);
    return cachedConfig;
  }
}

/**
 * Returns agent-specific configuration with defaults
 * Supports: research, writer, planner, integrations
 */
export function getAgentConfig(agentName: 'research' | 'writer' | 'planner' | 'integrations'): AgentConfig {
  const config = getConfig();

  // Return specific agent config
  if (config.agents && config.agents[agentName]) {
    return config.agents[agentName];
  }

  // Fallback to default development config for the agent
  return defaultDevelopmentConfig.agents[agentName];
}

/**
 * Returns concierge-specific configuration
 */
export function getConciergeConfig(): ConciergeConfig {
  const config = getConfig();
  return config.concierge || defaultDevelopmentConfig.concierge;
}

/**
 * Returns model parameters for API calls
 * Handles both GPT-5 and non-GPT-5 models appropriately
 */
export function getModelParams(agentName?: 'research' | 'writer' | 'planner' | 'integrations'): {
  model: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  // OpenAI only supports 'low' | 'medium' | 'high', but we map 'minimal' -> 'low'
  reasoning_effort?: 'low' | 'medium' | 'high';
  max_output_tokens?: number;
} {
  let modelConfig: AIModelConfig;

  if (agentName) {
    const agentConfig = getAgentConfig(agentName);
    modelConfig = agentConfig.model;
  } else {
    const conciergeConfig = getConciergeConfig();
    modelConfig = conciergeConfig.model;
  }

  // Check if it's a GPT-5 model config
  if ('reasoning_effort' in modelConfig) {
    // GPT-5 model - map 'minimal' to 'low' for OpenAI compatibility
    const effort = modelConfig.reasoning_effort === 'minimal' ? 'low' : modelConfig.reasoning_effort;
    return {
      model: modelConfig.model,
      reasoning_effort: effort as 'low' | 'medium' | 'high',
      max_output_tokens: modelConfig.max_output_tokens,
    };
  }

  // Non-GPT-5 model (BaseAIModelConfig)
  return {
    model: modelConfig.model,
    temperature: modelConfig.temperature,
    max_tokens: modelConfig.max_tokens,
    top_p: modelConfig.top_p,
  };
}

/**
 * Checks if a model is a GPT-5 variant
 */
export function isGpt5Model(model: string): boolean {
  return model === 'gpt-5' || model === 'gpt-5-nano';
}

/**
 * Returns GPT-5 specific parameters
 * Uses environment variables as fallback if not in config
 */
export function getGpt5Params(modelConfig?: AIModelConfig): {
  reasoning_effort: string;
  verbosity: string;
  max_output_tokens: number;
} {
  // If a model config is provided and it's GPT-5, use it
  if (modelConfig && 'reasoning_effort' in modelConfig) {
    return {
      reasoning_effort: modelConfig.reasoning_effort,
      verbosity: modelConfig.verbosity,
      max_output_tokens: modelConfig.max_output_tokens,
    };
  }

  // Otherwise use environment variables or defaults
  return {
    reasoning_effort: process.env.GPT_5_REASONING_EFFORT_DEFAULT || 'minimal',
    verbosity: process.env.GPT_5_VERBOSITY_DEFAULT || 'low',
    max_output_tokens: parseInt(process.env.GPT_5_MAX_OUTPUT_TOKENS_DEFAULT || '2000'),
  };
}

/**
 * Deep merge utility for combining configs
 */
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
      if (targetValue && typeof targetValue === 'object' && !Array.isArray(targetValue)) {
        result[key] = deepMerge(targetValue, sourceValue);
      } else {
        result[key] = sourceValue as any;
      }
    } else {
      result[key] = sourceValue as any;
    }
  }

  return result;
}

/**
 * Returns default configuration based on profile
 */
function getDefaultConfigForProfile(profile: string): POFConfig {
  if (profile === 'production') {
    return defaultProductionConfig;
  }
  // Default to development config for 'development' and 'test'
  return defaultDevelopmentConfig;
}

/**
 * Reset cached config (useful for testing)
 */
export function resetConfigCache(): void {
  cachedConfig = null;
}
