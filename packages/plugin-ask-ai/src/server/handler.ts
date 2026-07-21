import OpenAI from 'openai'

// ── Public types ───────────────────────────────────────────────────

export interface StreamContext {
  page: string
  content: string
}

export interface StreamLLMResponseOptions {
  model: string
  systemPrompt: string
  question: string
  context: StreamContext | null
  maxOutputTokens: number
  baseURL?: string
  env: Record<string, string | undefined>
  signal?: AbortSignal
  provider?: string
  providerEnvKey?: string
  devMode?: boolean
}

export type StreamEvent =
  | {
      type: 'context'
      data: {
        page: string
        chars: number
        elapsedMs: number
        missing?: boolean
      }
    }
  | { type: 'text'; data: string }
  | {
      type: 'usage'
      data: {
        promptTokens: number
        completionTokens: number
        totalTokens: number
        model: string
        provider: string
        elapsedMs: number
      }
    }
  | { type: 'done' }
  | { type: 'error'; data: string }

export type StreamEventHandler = (event: StreamEvent) => void

const STREAM_TIMEOUT_MS = 60_000

const DOCS_START = '<<<DOCS_START>>>'
const DOCS_END = '<<<DOCS_END>>>'

// ── Build user prompt — data is wrapped between delimiters so the
//    system prompt's "treat as data only" rule applies unambiguously.

function escapeDocsMarkers(s: string): string {
  // Prevent a malicious or coincidental MDX content from breaking the
  // data/instruction boundary the system prompt relies on.
  return s.replace(/<<<DOCS_(START|END)>>>/g, '<DOCS_$1>')
}

function buildUserPrompt(question: string, context: StreamContext | null) {
  if (!context || !context.content) {
    return `${DOCS_START}\n(no documentation page in scope — reply "Not in docs." for any Boltdocs question)\n${DOCS_END}\n\nUser Question: ${question}`
  }
  return [
    DOCS_START,
    `[Page: ${context.page}]`,
    escapeDocsMarkers(context.content),
    DOCS_END,
    '',
    `User Question: ${question}`,
  ].join('\n')
}

// ── Public entry point ─────────────────────────────────────────────

export async function streamLLMResponse(
  options: StreamLLMResponseOptions,
  onEvent: StreamEventHandler,
): Promise<void> {
  const {
    model,
    systemPrompt,
    question,
    context,
    maxOutputTokens,
    baseURL,
    env,
    signal,
    provider = 'openai',
    providerEnvKey = 'OPENAI_API_KEY',
    devMode = false,
  } = options

  const apiKey = env[providerEnvKey]
  if (!apiKey) {
    onEvent({
      type: 'error',
      data: `${providerEnvKey} is not set in the server environment.`,
    })
    return
  }

  const userPrompt = buildUserPrompt(question, context)
  const openai = new OpenAI({
    apiKey,
    baseURL: baseURL || env.OPENAI_BASE_URL || undefined,
  })

  // Compose external + internal-timeout signals.
  const timeoutController = new AbortController()
  const combinedController = new AbortController()
  const externalSignal = signal

  const onExternalAbort = () => {
    if (!combinedController.signal.aborted) combinedController.abort()
  }
  const onTimeoutAbort = () => {
    if (!combinedController.signal.aborted) combinedController.abort()
  }
  if (externalSignal) {
    if (externalSignal.aborted) onExternalAbort()
    else
      externalSignal.addEventListener('abort', onExternalAbort, { once: true })
  }
  timeoutController.signal.addEventListener('abort', onTimeoutAbort, {
    once: true,
  })

  const timeoutId = setTimeout(
    () => timeoutController.abort(),
    STREAM_TIMEOUT_MS,
  )

  const streamStart = Date.now()
  try {
    const stream = await openai.chat.completions.create(
      {
        model,
        max_tokens: maxOutputTokens,
        stream: true,
        stream_options: { include_usage: true },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      },
      { signal: combinedController.signal },
    )

    let promptTokens = 0
    let completionTokens = 0

    for await (const chunk of stream) {
      if (externalSignal?.aborted || combinedController.signal.aborted) break
      const content = chunk.choices?.[0]?.delta?.content
      if (typeof content === 'string' && content.length > 0) {
        onEvent({ type: 'text', data: content })
      }
      const usage = (
        chunk as {
          usage?: { prompt_tokens?: number; completion_tokens?: number }
        }
      ).usage
      if (usage) {
        promptTokens = usage.prompt_tokens ?? promptTokens
        completionTokens = usage.completion_tokens ?? completionTokens
      }
    }

    if (devMode && (promptTokens > 0 || completionTokens > 0)) {
      onEvent({
        type: 'usage',
        data: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
          model,
          provider,
          elapsedMs: Date.now() - streamStart,
        },
      })
    }

    if (!externalSignal?.aborted && !combinedController.signal.aborted) {
      onEvent({ type: 'done' })
    }
  } catch (err) {
    if (externalSignal?.aborted || combinedController.signal.aborted) {
      return
    }
    const msg = err instanceof Error ? err.message : 'OpenAI request failed'
    onEvent({ type: 'error', data: msg })
  } finally {
    clearTimeout(timeoutId)
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort)
    }
    timeoutController.signal.removeEventListener('abort', onTimeoutAbort)
  }
}
