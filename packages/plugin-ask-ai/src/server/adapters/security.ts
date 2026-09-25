import { rateLimit } from '../../node/rate-limit'
import { checkInputSafety, DEFAULT_DENY_PATTERNS } from '../../node/safety'
import type { AdapterConfig } from './types'

export function isAuthorized(config: AdapterConfig, headers: Headers): boolean {
  if (!config.secretKey) return true
  return headers.get('x-boltdocs-ask-ai-key') === config.secretKey
}

export function validateClientContext(
  config: AdapterConfig,
  body: unknown,
  headers: Headers,
): string | null {
  if (!body || typeof body !== 'object' || !('context' in body)) return null
  if (
    config.allowClientContext ||
    (Boolean(config.secretKey) && isAuthorized(config, headers))
  ) {
    return null
  }
  return 'CLIENT_CONTEXT_NOT_ALLOWED'
}

export function validateQuestion(
  config: AdapterConfig,
  body: unknown,
): string | null {
  const question =
    body && typeof body === 'object' && 'question' in body
      ? (body as { question?: unknown }).question
      : undefined

  const safety = checkInputSafety(
    typeof question === 'string' ? question : '',
    config.maxInputChars ?? 2_000,
    DEFAULT_DENY_PATTERNS,
  )
  return safety.ok ? null : safety.reason
}

export function checkAdapterRateLimit(
  config: AdapterConfig,
  ip: string,
): { ok: true } | { ok: false; retryAfter: number } {
  return rateLimit(ip, config.rateLimitPerMinute ?? 30)
}
