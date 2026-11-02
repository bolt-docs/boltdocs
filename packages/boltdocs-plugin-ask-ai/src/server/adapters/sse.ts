import type { StreamEvent } from '../handler'

export function eventToSse(event: StreamEvent): string {
  switch (event.type) {
    case 'context':
      return `data: ${JSON.stringify({ context: event.data })}\n\n`
    case 'text':
      return `data: ${JSON.stringify({ text: event.data })}\n\n`
    case 'usage':
      return `data: ${JSON.stringify({ usage: event.data })}\n\n`
    case 'error':
      return `data: ${JSON.stringify({ error: event.data })}\n\n`
    case 'done':
      return ''
  }
}

export const DONE_SSE = 'data: [DONE]\n\n'
