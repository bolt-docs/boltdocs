export interface AdapterConfig {
  provider: string
  model: string
  systemPrompt: string
}

export type AdapterEnv = Record<string, string | undefined>
