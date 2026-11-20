import type { BoltdocsConfig } from '../config'

/**
 * Generates a Content Security Policy (CSP) header string based on the configuration.
 * Automatically adapts to the environment (development vs production).
 *
 * @param config - The Boltdocs configuration object.
 * @returns The CSP header value.
 */
export function getCSPHeader(_config: BoltdocsConfig): string {
  const isDev = process.env.NODE_ENV === 'development'

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'https:'],
    'font-src': ["'self'"],
    'connect-src': ["'self'"],
  }

  // Relax policies in development to support Vite's HMR (eval-based)
  if (isDev) {
    directives['script-src'] = ["'self'", "'unsafe-eval'", "'unsafe-inline'"]
    directives['style-src'] = ["'self'", "'unsafe-inline'"]
  }

  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ')
}
