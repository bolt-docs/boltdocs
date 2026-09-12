export interface AdapterConfig {
  model: string
  systemPrompt: string
  maxOutputTokens?: number
  contextChars?: number
  secretKey?: string
  allowClientContext?: boolean
  rateLimitPerMinute?: number
}

export type AdapterEnv = Record<string, string | undefined>
