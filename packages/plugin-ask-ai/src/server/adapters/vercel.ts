import { streamLLMResponse } from '../handler'
import type { StreamContext, StreamEvent } from '../handler'
import { headers } from './headers'
import type { AdapterConfig, AdapterEnv } from './types'

function writeVercelEvent(res: any, event: StreamEvent): void {
  switch (event.type) {
    case 'context':
      res.write(`data: ${JSON.stringify({ context: event.data })}\n\n`)
      break
    case 'text':
      res.write(`data: ${JSON.stringify({ text: event.data })}\n\n`)
      break
    case 'error':
      res.write(`data: ${JSON.stringify({ error: event.data })}\n\n`)
      break
    case 'done':
      // [DONE] is emitted by the adapter itself.
      break
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

export async function handleVercelAskAi(
  req: any,
  res: any,
  config: AdapterConfig,
  env: AdapterEnv = process.env as Record<string, string | undefined>,
): Promise<void> {
  Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value))

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).end('Method Not Allowed')
    return
  }

  try {
    const { question } = req.body || {}
    if (!question) {
      res.status(400).json({ error: 'Missing question in request body' })
      return
    }

    const ctx = pickContext(req.body, config.contextChars ?? 6_000)

    await streamLLMResponse(
      {
        model: config.model,
        systemPrompt: config.systemPrompt,
        question,
        context: ctx,
        maxOutputTokens: config.maxOutputTokens ?? 600,
        env,
      },
      (event) => writeVercelEvent(res, event),
    )

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    res.write(
      `data: ${JSON.stringify({ error: err instanceof Error ? err.message : 'Server error' })}\n\n`,
    )
    res.end()
  }
}
