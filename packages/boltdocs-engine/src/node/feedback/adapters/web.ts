import type { FeedbackPayload } from '../github'
import { handleFeedback } from '../handler'
import { headers } from './headers'

export async function handleWebFeedback(
  request: Request,
  env: Record<string, string | undefined> = {},
): Promise<Response> {
  const jsonResponse = (data: unknown, status = 200) =>
    new Response(data ? JSON.stringify(data) : null, { status, headers })

  if (request.method === 'OPTIONS') {
    return jsonResponse(null)
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405)
  }

  try {
    const payload = (await request.json()) as FeedbackPayload
    const mergedEnv = { ...process.env, ...env }
    const result = await handleFeedback(payload, mergedEnv)
    return jsonResponse(result)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to submit feedback'
    return jsonResponse({ error: message }, 500)
  }
}
