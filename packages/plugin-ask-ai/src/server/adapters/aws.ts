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

export async function handleAwsAskAi(
  event: any,
  config: AdapterConfig,
  env: AdapterEnv = process.env as Record<string, string | undefined>,
): Promise<any> {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    }
  }

  try {
    const payload = event.body ? JSON.parse(event.body) : {}
    const { question } = payload
    if (!question) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing question in request body' }),
      }
    }
    const ctx = pickContext(payload, config.contextChars ?? 6_000)

    const parts: string[] = []
    await streamLLMResponse(
      {
        model: config.model,
        systemPrompt: config.systemPrompt,
        question,
        context: ctx,
        maxOutputTokens: config.maxOutputTokens ?? 600,
        env,
      },
      (ev) => {
        const sse = eventToSse(ev)
        if (sse) parts.push(sse)
      },
    )
    parts.push('data: [DONE]\n\n')

    return { statusCode: 200, headers, body: parts.join('') }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to query AI assistant'
    return {
      statusCode: 500,
      headers,
      body: `data: ${JSON.stringify({ error: message })}\n\ndata: [DONE]\n\n`,
    }
  }
}
