import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleFeedback } from '../handler'
import { headers } from './headers'

export async function handleVercelFeedback(
  req: VercelRequest,
  res: VercelResponse,
) {
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value)
  })

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  try {
    const result = await handleFeedback(req.body, process.env)
    res.status(200).json(result)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to submit feedback'
    return res.status(500).json({ error: message })
  }
}
