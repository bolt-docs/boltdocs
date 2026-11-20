import { handleFeedback } from '../handler'
import type { HandlerEvent, HandlerResponse } from '@netlify/functions'
import { headers } from './headers'

export async function handleNetlifyFeedback(
  event: HandlerEvent,
  env: Record<string, string | undefined> = process.env,
): Promise<HandlerResponse> {
  const sendResponse = (
    bodyData: unknown,
    statusCode = 200,
  ): HandlerResponse => ({
    statusCode,
    headers,
    body: bodyData ? JSON.stringify(bodyData) : '',
  })

  if (event.httpMethod === 'OPTIONS') {
    return sendResponse(null, 200)
  }

  if (event.httpMethod !== 'POST') {
    return sendResponse({ error: 'Method Not Allowed' }, 405)
  }

  try {
    const payload = event.body ? JSON.parse(event.body) : {}
    const result = await handleFeedback(payload, env)

    return sendResponse(result)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to submit feedback'
    return sendResponse({ error: message }, 500)
  }
}
