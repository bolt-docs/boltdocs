import { streamLLMResponse } from '../handler'
import { headers } from './headers'
import type { AdapterConfig, AdapterEnv } from './types'

export async function handleNetlifyAskAi(
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
    const { question, context } = payload

    if (!question) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing question in request body' }),
      }
    }

    let accumulatedBody = ''
    await streamLLMResponse(
      {
        provider: config.provider,
        model: config.model,
        systemPrompt: config.systemPrompt,
        question,
        context: context || [],
        env,
      },
      (chunk) => {
        accumulatedBody += `data: ${JSON.stringify({ text: chunk })}\n\n`
      },
    )
    accumulatedBody += 'data: [DONE]\n\n'

    return { statusCode: 200, headers, body: accumulatedBody }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to query AI assistant'
    return {
      statusCode: 500,
      headers,
      body: `data: ${JSON.stringify({ error: message })}\n\n`,
    }
  }
}
