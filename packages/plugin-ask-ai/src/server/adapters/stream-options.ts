import type { StreamContext, StreamLLMResponseOptions } from '../handler'
import type { AdapterConfig, AdapterEnv } from './types'

export function createStreamOptions(
  config: AdapterConfig,
  question: string,
  context: StreamContext | null,
  env: AdapterEnv,
  signal?: AbortSignal,
): StreamLLMResponseOptions {
  const provider = config.provider ?? 'openai'
  const providerEnvKey = config.providerEnvKey ?? 'OPENAI_API_KEY'
  const providerEnv = {
    [providerEnvKey]: env[providerEnvKey],
    OPENAI_BASE_URL: env.OPENAI_BASE_URL,
  }

  return {
    model: config.model,
    systemPrompt: config.systemPrompt,
    question,
    context,
    maxOutputTokens: config.maxOutputTokens ?? 600,
    baseURL: config.baseURL,
    env: providerEnv,
    provider,
    providerEnvKey,
    signal,
    devMode: config.devMode ?? false,
    temperature: config.temperature,
    topP: config.topP,
  }
}
