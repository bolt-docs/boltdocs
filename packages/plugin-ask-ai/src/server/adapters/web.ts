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

export async function handleWebAskAi(
  request: Request,
  config: AdapterConfig,
  env: AdapterEnv = process.env as AdapterEnv,
): Promise<Response> {
  const corsHeaders = createAdapterHeaders(
    config,
    request.headers.get('origin'),
  )

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: corsHeaders,
    })
  }

  try {
    const bodyText = await request.text()
    if (
      new TextEncoder().encode(bodyText).byteLength >
      (config.maxRequestBytes ?? 65_536)
    ) {
      return new Response(JSON.stringify({ error: 'REQUEST_TOO_LARGE' }), {
        status: 413,
        headers: corsHeaders,
      })
    }
    const payload = bodyText ? JSON.parse(bodyText) : {}
    if (!isAuthorized(config, request.headers)) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), {
        status: 401,
        headers: corsHeaders,
      })
    }
    const contextError = validateClientContext(config, payload, request.headers)
    if (contextError) {
      return new Response(JSON.stringify({ error: contextError }), {
        status: 403,
        headers: corsHeaders,
      })
    }
    const questionError = validateQuestion(config, payload)
    if (questionError) {
      return new Response(JSON.stringify({ error: questionError }), {
        status: 400,
        headers: corsHeaders,
      })
    }
    const rate = checkAdapterRateLimit(
      config,
      request.headers.get('x-forwarded-for') || 'unknown',
    )
    if (!rate.ok) {
      corsHeaders['Retry-After'] = String(rate.retryAfter)
      return new Response(JSON.stringify({ error: 'RATE_LIMITED' }), {
        status: 429,
        headers: corsHeaders,
      })
    }

    const question = (payload as { question: string }).question
    const context = pickClientContext(payload, config.contextChars ?? 6_000)
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await streamLLMResponse(
            createStreamOptions(config, question, context, env, request.signal),
            (event) => {
              const sse = eventToSse(event)
              if (sse) controller.enqueue(encoder.encode(sse))
            },
          )
          controller.enqueue(encoder.encode(DONE_SSE))
        } catch {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: ADAPTER_ERROR })}\n\n`,
            ),
          )
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, { status: 200, headers: corsHeaders })
  } catch {
    return new Response(
      `data: ${JSON.stringify({ error: ADAPTER_ERROR })}\n\n${DONE_SSE}`,
      { status: 500, headers: corsHeaders },
    )
  }
}
