import { streamLLMResponse } from '../handler'
import type { StreamContext, StreamEvent } from '../handler'
import { headers } from './headers'
import type { AdapterConfig, AdapterEnv } from './types'

function eventToSse(event: StreamEvent): string {
  switch (event.type) {
    case 'context':
      return `data: ${JSON.stringify({ context: event.data })}\n\n`
    case 'text':
      return `data: ${JSON.stringify({ text: event.data })}\n\n`
    case 'error':
      return `data: ${JSON.stringify({ error: event.data })}\n\n`
    case 'done':
      return ''
    default:
      return ''
  }
}

function pickContext(body: any, contextChars: number): StreamContext | null {
  const c = body?.context
  if (
    c &&
    typeof c === 'object' &&
    typeof c.page === 'string' &&
    typeof c.content === 'string'
  ) {
    return {
      page: c.page.slice(0, 256),
      content: c.content.slice(0, contextChars),
    }
  }
  return null
}

export async function handleWebAskAi(
  request: Request,
  config: AdapterConfig,
  env: AdapterEnv = {},
): Promise<Response> {
  const corsHeaders = { ...headers }

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
    const payload = await request.json()
    const { question } = payload
    if (!question) {
      return new Response(
        JSON.stringify({ error: 'Missing question in request body' }),
        { status: 400, headers: corsHeaders },
      )
    }
    const ctx = pickContext(payload, config.contextChars ?? 6_000)

    const encoder = new TextEncoder()
    const mergedEnv = { ...process.env, ...env }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          await streamLLMResponse(
            {
              model: config.model,
              systemPrompt: config.systemPrompt,
              question,
              context: ctx,
              maxOutputTokens: config.maxOutputTokens ?? 600,
              env: mergedEnv,
            },
            (ev) => {
              const sse = eventToSse(ev)
              if (sse) controller.enqueue(encoder.encode(sse))
            },
          )
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : 'Unknown stream error'
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`),
          )
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, { status: 200, headers: corsHeaders })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to query AI assistant'
    return new Response(
      `data: ${JSON.stringify({ error: message })}\n\ndata: [DONE]\n\n`,
      { status: 500, headers: corsHeaders },
    )
  }
}
