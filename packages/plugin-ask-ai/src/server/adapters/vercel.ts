import { streamLLMResponse } from '../handler'
import { createAdapterHeaders } from './headers'
import { eventToSse } from './sse'
import { pickClientContext } from '../../node/context'
import { ADAPTER_ERROR } from '../errors'
import type { AdapterConfig, AdapterEnv } from './types'
import {
  checkAdapterRateLimit,
  isAuthorized,
  validateClientContext,
  validateQuestion,
} from './security'
import { createStreamOptions } from './stream-options'

export interface VercelAskAiRequest {
  method?: string
  headers?: unknown
  body?: unknown
  url?: string
}

export interface VercelAskAiResponse {
  setHeader(name: string, value: string): void
  status(code: number): VercelAskAiResponse
  write(chunk: string): void
  end(chunk?: string): void
  json(body: unknown): void
}

export async function handleVercelAskAi(
  req: VercelAskAiRequest,
  res: VercelAskAiResponse,
  config: AdapterConfig,
  env: AdapterEnv = process.env as AdapterEnv,
): Promise<void> {
  const requestHeaders = new Headers((req.headers ?? {}) as HeadersInit)
  const responseHeaders = createAdapterHeaders(
    config,
    requestHeaders.get('origin'),
  )
  for (const [key, value] of Object.entries(responseHeaders)) {
    res.setHeader(key, value)
  }

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).end('Method Not Allowed')
    return
  }

  try {
    if (!isAuthorized(config, requestHeaders)) {
      res.status(401).json({ error: 'UNAUTHORIZED' })
      return
    }
    const contextError = validateClientContext(config, req.body, requestHeaders)
    if (contextError) {
      res.status(403).json({ error: contextError })
      return
    }
    const questionError = validateQuestion(config, req.body)
    if (questionError) {
      res.status(400).json({ error: questionError })
      return
    }
    const rate = checkAdapterRateLimit(
      config,
      requestHeaders.get('x-forwarded-for') || 'unknown',
    )
    if (!rate.ok) {
      res.setHeader('Retry-After', String(rate.retryAfter))
      res.status(429).json({ error: 'RATE_LIMITED' })
      return
    }

    const question = (req.body as { question: string }).question
    const context = pickClientContext(req.body, config.contextChars ?? 6_000)
    await streamLLMResponse(
      createStreamOptions(config, question, context, env),
      (event) => {
        const sse = eventToSse(event)
        if (sse) res.write(sse)
      },
    )

    res.write('data: [DONE]\n\n')
    res.end()
  } catch {
    res.write(
      `data: ${JSON.stringify({ error: ADAPTER_ERROR })}\n\ndata: [DONE]\n\n`,
    )
    res.end()
  }
}
