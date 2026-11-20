/**
 * Standard Security Headers for hardened web applications.
 * Recommended by OWASP and industry best practices to prevent common web attacks.
 *
 * These can be applied as middleware in HTTP servers or as metadata in SSG deployments.
 */
export const SECURITY_HEADERS = {
  /** Prevents MIME type sniffing by the browser. */
  'X-Content-Type-Options': 'nosniff',

  /** Prevents the page from being embedded in iframes (anti-clickjacking). */
  'X-Frame-Options': 'DENY',

  /** Enables XSS filtering in modern browsers (legacy support). */
  'X-XSS-Protection': '1; mode=block',

  /** Controls how much referrer information is sent with requests. */
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  /** Restricts access to sensitive browser features (camera, mic, geo). */
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',

  /** Enforces HTTPS for the domain and all subdomains for 1 year. */
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
} as const

export type SecurityHeaderKey = keyof typeof SECURITY_HEADERS
