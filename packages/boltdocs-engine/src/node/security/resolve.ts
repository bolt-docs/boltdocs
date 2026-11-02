import type { BoltdocsConfig } from '../config'
import { SECURITY_HEADERS } from './headers'
import { getCSPHeader } from './csp'

/**
 * Resolves the final set of HTTP headers Boltdocs applies to every response.
 *
 * Merge order (later wins):
 * 1. `SECURITY_HEADERS` — the built-in hardening headers, production only.
 * 2. `Content-Security-Policy` — the generated default policy, when
 *    `security.enableCSP` is enabled (dev and production).
 * 3. `security.headers` — user-defined headers for every request.
 * 4. `security.customHeaders` — override headers, applied last so they can
 *    intentionally replace defaults (e.g. a hand-written CSP or a relaxed
 *    `Strict-Transport-Security` value for local testing).
 */
export function resolveSecurityHeaders(
  config: BoltdocsConfig,
  isProd: boolean,
): Record<string, string> {
  const headers: Record<string, string> = isProd ? { ...SECURITY_HEADERS } : {}

  if (config.security?.enableCSP) {
    headers['Content-Security-Policy'] = getCSPHeader(config)
  }

  Object.assign(headers, config.security?.headers)
  Object.assign(headers, config.security?.customHeaders)

  return headers
}
