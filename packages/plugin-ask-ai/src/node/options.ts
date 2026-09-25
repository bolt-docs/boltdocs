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

export const AskAiPluginOptionsSchema = z
  .object({
    /** Automatically mount the floating assistant in the docs shell. */
    autoInject: z.boolean().default(true),
    provider: z.enum(PROVIDERS).default('openai'),
    model: z.string().min(1).max(120).optional(),
    endpoint: z.string().default('/api/ask-ai'),
    baseURL: z.string().url().optional(),
    systemPrompt: z.string().optional(),
    /**
     * Per-provider system-prompt overrides. The matching provider key wins
     * over `systemPrompt` if both are provided.
     */
    systemPrompts: z
      .record(z.enum(PROVIDERS), z.string().optional())
      .optional(),
    /**
     * Custom identity/tone instructions. When set (and no `systemPrompt`/
     * `systemPrompts[provider]` full override is given) these are prepended to
     * the default prompt, letting you brand the assistant without weakening the
     * scoping/refusal rules.
     */
    persona: z.string().min(1).max(4_000).optional(),
    maxInputChars: z.number().int().positive().max(20_000).default(2_000),
    maxOutputTokens: z.number().int().positive().max(4_000).default(600),
    contextChars: z.number().int().positive().max(40_000).default(6_000),
    rateLimitPerMinute: z.number().int().nonnegative().default(30),
    maxRequestBytes: z.number().int().positive().max(1_048_576).default(65_536),
    /**
     * If set, callers must send a matching
     * `x-boltdocs-ask-ai-key` header. URL query secrets are rejected because
     * URLs leak into proxy and platform logs. DEPLOYMENT: deploy only behind
     * a trusted reverse proxy that strips/overwrites client-supplied
     * `x-forwarded-for` to prevent IP spoofing on the per-minute limiter.
     */
    secretKey: z.string().min(16).optional(),
    secretKeyEnv: z
      .string()
      .regex(/^[A-Z][A-Z0-9_]*$/, 'Must be an environment variable name')
      .optional(),
    devMode: z.boolean().default(false),

    // ── Generation params ────────────────────────────────────────────
    /** Sampling temperature for completions. 0 = deterministic. */
    temperature: z.number().min(0).max(2).default(0.3),
    /** Nucleus sampling cutoff (1 = no restriction). */
    topP: z.number().min(0).max(1).default(1),

    // ── Client UI copy (surfaced to the widget via plugin metadata) ──
    title: z.string().min(1).max(80).default('Ask Assistant'),
    placeholder: z.string().min(1).max(120).default('Ask about this page…'),
    emptyTitle: z.string().min(1).max(80).default('How can I help you today?'),
    emptyDescription: z
      .string()
      .min(1)
      .max(240)
      .default(
        'Ask anything about the current documentation page. The assistant only answers using the page you are viewing.',
      ),
    buttonTooltip: z.string().min(1).max(80).default('Ask AI assistant'),
    composerHint: z
      .string()
      .min(1)
      .max(120)
      .default('Enter to send · Shift+Enter for a new line'),
    classNames: z
      .object({
        root: z.string().max(500).optional(),
        panel: z.string().max(500).optional(),
        trigger: z.string().max(500).optional(),
        header: z.string().max(500).optional(),
        messages: z.string().max(500).optional(),
        message: z.string().max(500).optional(),
        userMessage: z.string().max(500).optional(),
        assistantMessage: z.string().max(500).optional(),
        emptyState: z.string().max(500).optional(),
        composer: z.string().max(500).optional(),
        input: z.string().max(500).optional(),
        markdown: z.string().max(500).optional(),
      })
      .default({}),
  })
  .superRefine((options, ctx) => {
    const requiresProxy = ['anthropic', 'gemini', 'azure', 'custom'] as const
    if (
      requiresProxy.includes(
        options.provider as (typeof requiresProxy)[number],
      ) &&
      !options.baseURL
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['baseURL'],
        message: `${options.provider} requires an explicit OpenAI-compatible baseURL`,
      })
    }
  })

type ParsedAskAiOptions = z.output<typeof AskAiPluginOptionsSchema>

export type AskAiPluginOptions = z.input<typeof AskAiPluginOptionsSchema>

export function parseAskAiOptions(
  rawOptions: AskAiPluginOptions = {},
): ParsedAskAiOptions & { model: string } {
  const parsed = AskAiPluginOptionsSchema.parse(rawOptions)
  const model = parsed.model ?? PROVIDER_PRESETS[parsed.provider].defaultModel
  return { ...parsed, model }
}

/** Client-facing slice of the options, shipped through plugin metadata. */
export interface AskAiClientMetadata {
  provider?: string
  model?: string
  endpoint?: string
  devMode?: boolean
  title?: string
  placeholder?: string
  emptyTitle?: string
  emptyDescription?: string
  buttonTooltip?: string
  composerHint?: string
  classNames?: AskAiClassNames
}

export interface AskAiClassNames {
  root?: string
  panel?: string
  trigger?: string
  header?: string
  messages?: string
  message?: string
  userMessage?: string
  assistantMessage?: string
  emptyState?: string
  composer?: string
  input?: string
  markdown?: string
}

/**
 * Builds the public metadata record the widget reads at runtime. Kept as a
 * single source of truth so the client-facing shape stays in lock-step with
 * the schema defaults.
 */
export function buildClientMetadata(
  parsed: z.output<typeof AskAiPluginOptionsSchema>,
): AskAiClientMetadata {
  return {
    provider: parsed.provider,
    model: parsed.model ?? PROVIDER_PRESETS[parsed.provider].defaultModel,
    endpoint: parsed.endpoint,
    devMode: parsed.devMode,
    title: parsed.title,
    placeholder: parsed.placeholder,
    emptyTitle: parsed.emptyTitle,
    emptyDescription: parsed.emptyDescription,
    buttonTooltip: parsed.buttonTooltip,
    composerHint: parsed.composerHint,
    classNames: parsed.classNames,
  }
}
