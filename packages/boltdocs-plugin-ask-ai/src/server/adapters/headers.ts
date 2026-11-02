import type { AdapterConfig } from './types'

export const headers: Record<string, string> = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Boltdocs-Ask-AI-Key',
}

export function createAdapterHeaders(
  config: AdapterConfig,
  requestOrigin?: string | null,
): Record<string, string> {
  const result = { ...headers }
  const allowed = config.allowedOrigins ?? []

  if (requestOrigin && allowed.includes('*')) {
    result['Access-Control-Allow-Origin'] = '*'
  } else if (requestOrigin && allowed.includes(requestOrigin)) {
    result['Access-Control-Allow-Origin'] = requestOrigin
    result.Vary = 'Origin'
  }

  return result
}
