import { streamLLMResponse } from '../handler'
import { headers } from './headers'

export async function handleWebAskAi(
  request: Request,
  config: { provider: string; model: string; systemPrompt: string },
  env: Record<string, string | undefined> = {},
): Promise<Response> {
  const corsHeaders = {
    ...headers,
  }

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
    const { question, context } = await request.json()

    if (!question) {
      return new Response(JSON.stringify({ error: 'Missing question in request body' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    const encoder = new TextEncoder()
    const mergedEnv = { ...process.env, ...env }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          await streamLLMResponse(
            {
              provider: config.provider,
              model: config.model,
              systemPrompt: config.systemPrompt,
              question,
              context: context || [],
              env: mergedEnv,
            },
            (chunk) => {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`))
            },
          )
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Unknown stream error'
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errMsg })}\n\n`))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      status: 200,
      headers: corsHeaders,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to query AI assistant'
    return new Response(
      `data: ${JSON.stringify({ error: message })}\n\n`,
      {
        status: 500,
        headers: corsHeaders,
      },
    )
  }
}
