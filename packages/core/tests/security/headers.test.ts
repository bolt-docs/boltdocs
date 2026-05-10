import { describe, it, expect, afterEach } from 'vitest'
import { SECURITY_HEADERS } from '../../src/node/security/headers'
import { getCSPHeader } from '../../src/node/security/csp'
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
        'max-age=31536000; includeSubDomains',
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
})
