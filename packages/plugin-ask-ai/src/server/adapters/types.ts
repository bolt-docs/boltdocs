export interface AdapterConfig {
  model: string
  systemPrompt: string
  maxOutputTokens?: number
  contextChars?: number
}

export type AdapterEnv = Record<string, string | undefined>
