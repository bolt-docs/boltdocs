import { info, warn } from '@bdocs/dui'

export interface StreamLLMResponseOptions {
  provider: string
  model: string
  systemPrompt: string
  question: string
  context: string[]
  env: Record<string, string | undefined>
  debug?: boolean
  signal?: AbortSignal
}

const STREAM_TIMEOUT = 60_000 // 60 seconds max wait for first token
const BATCH_INTERVAL_MS = 50 // ms to batch chunks before flushing

/**
 * Reads a streaming SSE response body and calls onChunk for each text token.
 * Supports AbortSignal for cancellation and batches chunks for efficiency.
 */
async function readSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
  onChunk: (text: string) => void,
  options: { debug?: boolean; signal?: AbortSignal },
): Promise<void> {
  const { debug, signal } = options
  let buffer = ''
  let batchBuffer = ''
  let batchTimer: ReturnType<typeof setTimeout> | null = null

  const flushBatch = () => {
    if (batchTimer) {
      clearTimeout(batchTimer)
      batchTimer = null
    }
    if (batchBuffer) {
      onChunk(batchBuffer)
      batchBuffer = ''
    }
  }

  const scheduleFlush = () => {
    if (batchTimer) clearTimeout(batchTimer)
    batchTimer = setTimeout(flushBatch, BATCH_INTERVAL_MS)
  }

  // If signal is already aborted, bail early
  if (signal?.aborted) return

  const abortHandler = () => {
    flushBatch()
    reader.cancel().catch(() => {})
  }

  signal?.addEventListener('abort', abortHandler, { once: true })

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      if (signal?.aborted) return

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const cleaned = line.trim()
        if (!cleaned.startsWith('data:')) continue

        const dataStr = cleaned.slice(5).trim()
        if (dataStr === '[DONE]') continue

        try {
          const parsed = JSON.parse(dataStr)

          // OpenAI / Ollama format
          const content =
            parsed.choices?.[0]?.delta?.content ||
            // Anthropic format
            parsed.delta?.text ||
            (parsed.type === 'content_block_delta' && parsed.delta?.text) ||
            null

          if (content) {
            batchBuffer += content
            scheduleFlush()
          }
        } catch (e) {
          if (debug) warn(`[Ask AI]   Parse error: ${e}`)
        }
      }
    }
  } finally {
    signal?.removeEventListener('abort', abortHandler)
    // Flush any remaining batched content
    clearTimeout(batchTimer as any)
    if (batchBuffer) onChunk(batchBuffer)
  }
}

export async function streamLLMResponse(
  options: StreamLLMResponseOptions,
  onChunk: (text: string) => void,
): Promise<void> {
  const {
    provider,
    model,
    systemPrompt,
    question,
    context,
    env,
    debug,
    signal,
  } = options

  // Format context for LLM
  const contextString =
    context && context.length > 0
      ? `Documentation Context:\n${context.map((c, i) => `[Doc ${i + 1}]: ${c}`).join('\n\n')}`
      : 'No direct documentation context was found for this query.'

  const fullPrompt = `${contextString}\n\nUser Question: ${question}`

  if (debug) {
    info(`[Ask AI]   Full prompt length: ${fullPrompt.length} chars`)
    info(`[Ask AI]   System prompt: ${systemPrompt.slice(0, 120)}...`)
  }

  // Create a timeout controller if no external signal provided
  const ownController = new AbortController()
  const combinedSignal = signal || ownController.signal

  // Timeout: if we don't get the first chunk within STREAM_TIMEOUT, abort
  const timeoutId = setTimeout(() => {
    if (debug)
      warn(`[Ask AI]   Timeout: no response within ${STREAM_TIMEOUT / 1000}s`)
    ownController.abort()
  }, STREAM_TIMEOUT)

  const clearTimeoutAndCheck = (): boolean => {
    clearTimeout(timeoutId)
    if (combinedSignal.aborted) return true
    return false
  }

  if (provider === 'anthropic') {
    const apiKey = env.ANTHROPIC_API_KEY
    if (!apiKey) {
      onChunk(
        '**Error**: `ANTHROPIC_API_KEY` is not set in the environment variables.',
      )
      clearTimeout(timeoutId)
      return
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        system: systemPrompt,
        messages: [{ role: 'user', content: fullPrompt }],
        max_tokens: 1500,
        stream: true,
      }),
      signal: combinedSignal,
    })

    if (clearTimeoutAndCheck()) return

    if (!response.ok) {
      const errorText = await response.text()
      if (debug)
        warn(
          `[Ask AI]   Anthropic API error: ${response.status} - ${errorText}`,
        )
      throw new Error(
        `Anthropic API returned error: ${response.status} - ${errorText}`,
      )
    }

    if (!response.body) {
      throw new Error('No response body returned from Anthropic API')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    const anthropicOnChunk = (text: string) => {
      if (clearTimeoutAndCheck()) return
      onChunk(text)
    }

    await readSSEStream(reader, decoder, anthropicOnChunk, {
      debug,
      signal: combinedSignal,
    })
  } else if (provider === 'openai' || provider === 'custom') {
    const apiKey = env.OPENAI_API_KEY
    const baseURL = env.OPENAI_BASE_URL || 'https://api.openai.com/v1'

    if (debug) {
      info(`[Ask AI]   Calling: ${baseURL}/chat/completions`)
      info(`[Ask AI]   API key: ${apiKey ? 'SET' : 'NOT SET'}`)
    }

    if (!apiKey && provider === 'openai') {
      onChunk(
        '**Error**: `OPENAI_API_KEY` is not set in the environment variables.',
      )
      clearTimeout(timeoutId)
      return
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: fullPrompt },
        ],
        stream: true,
      }),
      signal: combinedSignal,
    })

    if (clearTimeoutAndCheck()) return

    if (debug) {
      info(`[Ask AI]   Response status: ${response.status}`)
      info(`[Ask AI]   Response body: ${response.body ? 'YES' : 'NO'}`)
    }

    if (!response.ok) {
      const errorText = await response.text()
      if (debug) warn(`[Ask AI]   API error: ${response.status} - ${errorText}`)
      throw new Error(
        `OpenAI-compatible API returned error: ${response.status} - ${errorText}`,
      )
    }

    if (!response.body) {
      throw new Error('No response body returned from OpenAI-compatible API')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    const openaiOnChunk = (text: string) => {
      if (clearTimeoutAndCheck()) return
      onChunk(text)
    }

    await readSSEStream(reader, decoder, openaiOnChunk, {
      debug,
      signal: combinedSignal,
    })
  } else {
    clearTimeout(timeoutId)
    throw new Error(`Unsupported AI provider: ${provider}`)
  }

  clearTimeout(timeoutId)
}
