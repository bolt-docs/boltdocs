import { describe, it, expect, afterEach } from 'vitest'
import { SECURITY_HEADERS } from '../../src/node/security/headers'
import { getCSPHeader } from '../../src/node/security/csp'
import { resolveSecurityHeaders } from '../../src/node/security/resolve'
import type { BoltdocsConfig } from '../../src/node/config'

describe('Security: Headers and CSP', () => {
  const mockConfig: BoltdocsConfig = {
    docsDir: 'docs',
    security: {
      enableCSP: true,
    },
  }

  describe('SECURITY_HEADERS', () => {
    it('should contain all required security headers', () => {
      const requiredHeaders = [
        'X-Content-Type-Options',
        'X-Frame-Options',
        'X-XSS-Protection',
        'Referrer-Policy',
        'Permissions-Policy',
        'Strict-Transport-Security',
      ]

      requiredHeaders.forEach((header) => {
        expect(SECURITY_HEADERS).toHaveProperty(header)
      })
    })

    it('should have correct values for each header', () => {
      expect(SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff')
      expect(SECURITY_HEADERS['X-Frame-Options']).toBe('DENY')
      expect(SECURITY_HEADERS['X-XSS-Protection']).toBe('1; mode=block')
      expect(SECURITY_HEADERS['Referrer-Policy']).toBe(
        'strict-origin-when-cross-origin',
      )
      expect(SECURITY_HEADERS['Permissions-Policy']).toBe(
        'camera=(), microphone=(), geolocation=()',
      )
      expect(SECURITY_HEADERS['Strict-Transport-Security']).toBe(
        'max-age=31536000; includeSubDomains; preload',
      )
    })
  })

  describe('getCSPHeader', () => {
    const originalEnv = process.env.NODE_ENV

    afterEach(() => {
      process.env.NODE_ENV = originalEnv
    })

    it('should generate a valid CSP string with base directives', () => {
      process.env.NODE_ENV = 'production'
      const csp = getCSPHeader(mockConfig)

      expect(csp).toContain("default-src 'self'")
      expect(csp).toContain("img-src 'self' data: https:")
      expect(csp).toContain("font-src 'self'")
    })

    it('should not include unsafe-eval in production', () => {
      process.env.NODE_ENV = 'production'
      const csp = getCSPHeader(mockConfig)

      expect(csp).not.toContain("'unsafe-eval'")
    })

    it('should include unsafe-eval in development', () => {
      process.env.NODE_ENV = 'development'
      const csp = getCSPHeader(mockConfig)

      expect(csp).toContain("'unsafe-eval'")
    })

    it('should include unsafe-inline for scripts and styles in all environments', () => {
      process.env.NODE_ENV = 'development'
      const devCsp = getCSPHeader(mockConfig)
      expect(devCsp).toContain(
        "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      )
      expect(devCsp).toContain("style-src 'self' 'unsafe-inline'")

      process.env.NODE_ENV = 'production'
      const prodCsp = getCSPHeader(mockConfig)
      expect(prodCsp).toContain("script-src 'self' 'unsafe-inline'")
      expect(prodCsp).toContain("style-src 'self' 'unsafe-inline'")
    })
  })

  describe('resolveSecurityHeaders', () => {
    it('applies the default security headers only in production', () => {
      const prod = resolveSecurityHeaders(mockConfig, true)
      expect(prod['X-Content-Type-Options']).toBe('nosniff')
      expect(prod['Strict-Transport-Security']).toContain('preload')

      const dev = resolveSecurityHeaders(mockConfig, false)
      expect(dev['X-Content-Type-Options']).toBeUndefined()
    })

    it('includes the generated CSP when enableCSP is set', () => {
      const headers = resolveSecurityHeaders(mockConfig, true)
      expect(headers['Content-Security-Policy']).toContain("default-src 'self'")
    })

    it('does not generate a CSP when enableCSP is off', () => {
      const headers = resolveSecurityHeaders({ docsDir: 'docs' }, true)
      expect(headers['Content-Security-Policy']).toBeUndefined()
    })

    it('merges custom headers after the defaults', () => {
      const config: BoltdocsConfig = {
        docsDir: 'docs',
        security: {
          headers: { 'X-Custom': 'yes', 'X-Frame-Options': 'SAMEORIGIN' },
        },
      }
      const headers = resolveSecurityHeaders(config, true)
      expect(headers['X-Custom']).toBe('yes')
      // security.headers can relax a default.
      expect(headers['X-Frame-Options']).toBe('SAMEORIGIN')
    })

    it('lets customHeaders override security.headers', () => {
      const config: BoltdocsConfig = {
        docsDir: 'docs',
        security: {
          headers: { 'X-Frame-Options': 'SAMEORIGIN' },
          customHeaders: { 'X-Frame-Options': 'DENY' },
        },
      }
      const headers = resolveSecurityHeaders(config, true)
      expect(headers['X-Frame-Options']).toBe('DENY')
    })

    it('lets customHeaders replace the generated CSP', () => {
      const config: BoltdocsConfig = {
        docsDir: 'docs',
        security: {
          enableCSP: true,
          customHeaders: {
            'Content-Security-Policy': "default-src 'none'",
          },
        },
      }
      const headers = resolveSecurityHeaders(config, true)
      expect(headers['Content-Security-Policy']).toBe("default-src 'none'")
    })

    it('applies custom headers in development too', () => {
      const config: BoltdocsConfig = {
        docsDir: 'docs',
        security: {
          customHeaders: { 'X-Robots-Tag': 'noindex' },
        },
      }
      const headers = resolveSecurityHeaders(config, false)
      expect(headers['X-Robots-Tag']).toBe('noindex')
    })
  })
})
