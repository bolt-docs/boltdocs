import { streamLLMResponse } from '../handler'
import { headers } from './headers'

export async function handleVercelAskAi(
  req: any,
  res: any,
  config: { provider: string; model: string; systemPrompt: string },
) {
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value)
  })

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).end('Method Not Allowed')
    return
  }

  try {
    const { question, context } = req.body || {}
    if (!question) {
      res.status(400).json({ error: 'Missing question in request body' })
      return
    }

    await streamLLMResponse(
      {
        provider: config.provider,
        model: config.model,
        systemPrompt: config.systemPrompt,
        question,
        context: context || [],
        env: process.env,
      },
      (chunk) => {
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`)
      },
    )

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err instanceof Error ? err.message : 'Server error' })}\n\n`)
    res.end()
  }
}
