import { streamLLMResponse } from '../handler'
import { pickClientContext } from '../../node/context'
import { ADAPTER_ERROR } from '../errors'
import { createAdapterHeaders } from './headers'
import { DONE_SSE, eventToSse } from './sse'
import type { AdapterConfig, AdapterEnv } from './types'
import {
  checkAdapterRateLimit,
  isAuthorized,
  validateClientContext,
  validateQuestion,
} from './security'
import { createStreamOptions } from './stream-options'

export interface NetlifyAskAiEvent {
  httpMethod?: string
  headers?: unknown
  body?: string | null
  path?: string
}

export interface NetlifyAskAiResponse {
  statusCode: number
  headers: Record<string, string>
  body: string
}

export async function handleNetlifyAskAi(
  event: NetlifyAskAiEvent,
  config: AdapterConfig,
  env: AdapterEnv = process.env as AdapterEnv,
): Promise<NetlifyAskAiResponse> {
  const requestHeaders = new Headers((event.headers ?? {}) as HeadersInit)
  const responseHeaders = createAdapterHeaders(
    config,
    requestHeaders.get('origin'),
  )

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: responseHeaders, body: '' }
  }
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: responseHeaders,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    }
  }

  try {
    const bodyText = event.body ?? ''
    if (
      new TextEncoder().encode(bodyText).byteLength >
      (config.maxRequestBytes ?? 65_536)
    ) {
      return {
        statusCode: 413,
        headers: responseHeaders,
        body: JSON.stringify({ error: 'REQUEST_TOO_LARGE' }),
      }
    }
    const payload = bodyText ? JSON.parse(bodyText) : {}
    if (!isAuthorized(config, requestHeaders)) {
      return {
        statusCode: 401,
        headers: responseHeaders,
        body: JSON.stringify({ error: 'UNAUTHORIZED' }),
      }
    }
    const contextError = validateClientContext(config, payload, requestHeaders)
    if (contextError) {
      return {
        statusCode: 403,
        headers: responseHeaders,
        body: JSON.stringify({ error: contextError }),
      }
    }
    const questionError = validateQuestion(config, payload)
    if (questionError) {
      return {
        statusCode: 400,
        headers: responseHeaders,
        body: JSON.stringify({ error: questionError }),
      }
    }
    const rate = checkAdapterRateLimit(
      config,
      requestHeaders.get('x-forwarded-for') || 'unknown',
    )
    if (!rate.ok) {
      return {
        statusCode: 429,
        headers: { ...responseHeaders, 'Retry-After': String(rate.retryAfter) },
        body: JSON.stringify({ error: 'RATE_LIMITED' }),
      }
    }

    const question = (payload as { question: string }).question
    const context = pickClientContext(payload, config.contextChars ?? 6_000)
    const parts: string[] = []
    await streamLLMResponse(
      createStreamOptions(config, question, context, env),
      (event) => {
        const sse = eventToSse(event)
        if (sse) parts.push(sse)
      },
    )
    parts.push(DONE_SSE)

    return { statusCode: 200, headers: responseHeaders, body: parts.join('') }
  } catch {
    return {
      statusCode: 500,
      headers: responseHeaders,
      body: `data: ${JSON.stringify({ error: ADAPTER_ERROR })}\n\n${DONE_SSE}`,
    }
  }
}
