import { z } from 'zod'

export const PROVIDERS = [
  'openai',
  'anthropic',
  'gemini',
  'mistral',
  'cohere',
  'deepseek',
  'groq',
  'openrouter',
  'together',
  'ollama',
  'azure',
  'custom',
] as const

export type Provider = (typeof PROVIDERS)[number]

export interface ProviderPreset {
  baseURL?: string
  defaultModel: string
  envKey: string
  label: string
}

export const PROVIDER_PRESETS: Record<Provider, ProviderPreset> = {
  openai: {
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    envKey: 'OPENAI_API_KEY',
    label: 'OpenAI',
  },
  anthropic: {
    baseURL: undefined,
    defaultModel: 'claude-3-5-haiku-latest',
    envKey: 'ANTHROPIC_API_KEY',
    label: 'Anthropic (requires OpenAI-compatible proxy)',
  },
  gemini: {
    baseURL: undefined,
    defaultModel: 'gemini-2.0-flash-exp',
    envKey: 'GEMINI_API_KEY',
    label: 'Google Gemini (requires OpenAI-compatible proxy)',
  },
  mistral: {
    baseURL: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-small-latest',
    envKey: 'MISTRAL_API_KEY',
    label: 'Mistral',
  },
  cohere: {
    baseURL: 'https://api.cohere.ai/v1',
    defaultModel: 'command-r-plus',
    envKey: 'COHERE_API_KEY',
    label: 'Cohere',
  },
  deepseek: {
    baseURL: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    envKey: 'DEEPSEEK_API_KEY',
    label: 'DeepSeek',
  },
  groq: {
    baseURL: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.1-8b-instant',
    envKey: 'GROQ_API_KEY',
    label: 'Groq',
  },
  openrouter: {
    baseURL: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o-mini',
    envKey: 'OPENROUTER_API_KEY',
    label: 'OpenRouter',
  },
  together: {
    baseURL: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Llama-3-70b-chat-hf',
    envKey: 'TOGETHER_API_KEY',
    label: 'Together AI',
  },
  ollama: {
    baseURL: 'http://localhost:11434/v1',
    defaultModel: 'llama3.2',
    envKey: 'OLLAMA_API_KEY',
    label: 'Ollama (enable OLLAMA_OPENAI_COMPAT=1)',
  },
  azure: {
    defaultModel: 'gpt-4o-mini',
    envKey: 'AZURE_OPENAI_API_KEY',
    label: 'Azure OpenAI (baseURL required)',
  },
  custom: {
    defaultModel: 'gpt-4o-mini',
    envKey: 'OPENAI_API_KEY',
    label: 'Custom (baseURL + envKey required)',
  },
}

export const AskAiPluginOptionsSchema = z.object({
  provider: z.enum(PROVIDERS).default('openai'),
  model: z
    .string()
    .min(1)
    .max(120)
    .default(PROVIDER_PRESETS.openai.defaultModel),
  endpoint: z.string().default('/api/ask-ai'),
  baseURL: z.string().url().optional(),
  systemPrompt: z.string().optional(),
  /**
   * Per-provider system-prompt overrides. The matching provider key wins
   * over `systemPrompt` if both are provided.
   */
  systemPrompts: z.record(z.enum(PROVIDERS), z.string().optional()).optional(),
  maxInputChars: z.number().int().positive().max(20_000).default(2_000),
  maxOutputTokens: z.number().int().positive().max(4_000).default(600),
  contextChars: z.number().int().positive().max(40_000).default(6_000),
  rateLimitPerMinute: z.number().int().nonnegative().default(30),
  /**
   * If set, callers must include `?secret=…` or header
   * `x-boltdocs-ask-ai-key` matching it. DEPLOYMENT: deploy only behind
   * a trusted reverse proxy that strips/overwrites client-supplied
   * `x-forwarded-for` to prevent IP spoofing on the per-minute limiter.
   */
  secretKey: z.string().min(8).optional(),
  customModels: z.array(z.string().min(1).max(120)).max(20).optional(),
  devMode: z.boolean().default(false),
})

export type AskAiPluginOptions = z.input<typeof AskAiPluginOptionsSchema>
