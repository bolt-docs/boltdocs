import { rateLimit } from '../../node/rate-limit'
import type { AdapterConfig } from './types'

export function isAuthorized(
  config: AdapterConfig,
  headers: Headers,
  url: string,
): boolean {
  if (!config.secretKey) return true
  const requestUrl = new URL(url, 'http://localhost')
  return (
    requestUrl.searchParams.get('secret') === config.secretKey ||
    headers.get('x-boltdocs-ask-ai-key') === config.secretKey
  )
}

export function validateClientContext(
  config: AdapterConfig,
  body: unknown,
  headers: Headers,
  url: string,
): string | null {
  if (!body || typeof body !== 'object' || !('context' in body)) return null
  if (
    config.allowClientContext ||
    (Boolean(config.secretKey) && isAuthorized(config, headers, url))
  ) {
    return null
  }
  return 'CLIENT_CONTEXT_NOT_ALLOWED'
}

export function checkAdapterRateLimit(
  config: AdapterConfig,
  ip: string,
): { ok: true } | { ok: false; retryAfter: number } {
  return rateLimit(ip, config.rateLimitPerMinute ?? 30)
}
