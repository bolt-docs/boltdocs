export interface AdapterConfig {
  model: string
  systemPrompt: string
  provider?: string
  providerEnvKey?: string
  baseURL?: string
  maxOutputTokens?: number
  maxInputChars?: number
  maxRequestBytes?: number
  contextChars?: number
  secretKey?: string
  allowClientContext?: boolean
  allowedOrigins?: string[]
  rateLimitPerMinute?: number
  devMode?: boolean
  temperature?: number
  topP?: number
}

export type AdapterEnv = Record<string, string | undefined>
