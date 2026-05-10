import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { injectHtmlMeta } from '../../src/node/plugin/html'
import { useAnalytics } from '../../src/client/hooks/use-analytics'
import * as React from 'react'

// Mock react
vi.mock('react', async () => {
  const actual = (await vi.importActual('react')) as any
  return {
    ...actual,
    useEffect: vi.fn((fn) => fn()),
    useMemo: vi.fn((fn) => fn()),
    useRef: vi.fn((val) => ({ current: val })),
    useCallback: vi.fn((fn) => fn),
  }
})

// Mock useLocation
vi.mock('../../src/client/hooks/use-location', () => ({
  useLocation: vi.fn(() => ({ pathname: '/', search: '' })),
}))

describe('Analytics Integration', () => {
  const baseHtml =
    '<!doctype html><html><head></head><body><div id="root"></div></body></html>'

  describe('Node-side: injectHtmlMeta', () => {
    const originalEnv = process.env.NODE_ENV

    afterEach(() => {
      process.env.NODE_ENV = originalEnv
    })

    it('should inject GA4 script with all options', () => {
      process.env.NODE_ENV = 'production'
      const config = {
        integrations: {
          ga4: {
            measurementId: 'G-XXXXX',
            anonymizeIp: true,
            sendPageView: false,
            cookieFlags: 'SameSite=None;Secure',
          },
        },
      }
      const result = injectHtmlMeta(baseHtml, config as any)

      expect(result).toContain(
        'https://www.googletagmanager.com/gtag/js?id=G-XXXXX',
      )
      expect(result).toContain("gtag('set', 'ip', true);")
      expect(result).toContain(
        "gtag('config', 'G-XXXXX', {send_page_view: false}, {'cookie_flags': 'SameSite=None;Secure'});",
      )
    })

    it('should inject GTM script with dataLayerName and preview', () => {
      process.env.NODE_ENV = 'production'
      const config = {
        integrations: {
          gtm: {
            tagId: 'GTM-XXXXX',
            dataLayerName: 'customDL',
            preview: 'env-1',
          },
        },
      }
      const result = injectHtmlMeta(baseHtml, config as any)

      expect(result).toContain("'customDL','GTM-XXXXX'")
      expect(result).toContain('&gtm_preview=env-1')
      expect(result).toContain(
        'https://www.googletagmanager.com/ns.html?id=GTM-XXXXX',
      )
    })
  })

  describe('Client-side: useAnalytics Hook', () => {
    let gtagSpy: any

    beforeEach(() => {
      vi.stubGlobal('window', {
        location: { hostname: 'localhost' },
        gtag: vi.fn(),
        dataLayer: [],
      })
      vi.stubGlobal('document', {
        title: 'Test Page',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
      gtagSpy = window.gtag
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('should use gtag when available', () => {
      const config = { ga4: { measurementId: 'G-XXXXX' } }
      const analytics = useAnalytics({ config })

      analytics.trackPageView('/test', 'Title')
      expect(gtagSpy).toHaveBeenCalledWith(
        'event',
        'page_view',
        expect.objectContaining({
          page_path: '/test',
          page_title: 'Title',
          send_to: 'G-XXXXX',
        }),
      )
    })

    it('should use dataLayer when gtag is missing but dataLayer exists', () => {
      vi.stubGlobal('window', {
        location: { hostname: 'localhost' },
        dataLayer: [],
      })
      const dataLayerSpy = vi.spyOn(window.dataLayer as any, 'push')
      const config = { gtm: { tagId: 'GTM-XXXXX' } }

      const analytics = useAnalytics({ config })
      analytics.trackEvent({ action: 'click', category: 'button' })

      expect(dataLayerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'click',
          event_category: 'button',
          send_to: 'GTM-XXXXX',
        }),
      )
    })

    it('should track external links', () => {
      const config = { ga4: { measurementId: 'G-XXXXX' } }
      useAnalytics({ config })

      // Get all click handlers and trigger them
      const clickHandlers = (document.addEventListener as any).mock.calls
        .filter((call: any) => call[0] === 'click')
        .map((call: any) => call[1])

      const mockEvent = {
        target: {
          closest: () => ({
            getAttribute: () => 'https://example.com',
            hasAttribute: () => false,
          }),
        },
      }

      clickHandlers.forEach((handler: any) => handler(mockEvent))
      expect(gtagSpy).toHaveBeenCalledWith(
        'event',
        'external_link',
        expect.objectContaining({
          link_url: 'https://example.com',
          send_to: 'G-XXXXX',
        }),
      )
    })

    it('should track downloads', () => {
      const config = { ga4: { measurementId: 'G-XXXXX' } }
      useAnalytics({ config })

      const clickHandlers = (document.addEventListener as any).mock.calls
        .filter((call: any) => call[0] === 'click')
        .map((call: any) => call[1])

      const mockEvent = {
        target: {
          closest: () => ({
            getAttribute: () => 'report.pdf',
            hasAttribute: (attr: string) => attr === 'download',
          }),
        },
      }

      clickHandlers.forEach((handler: any) => handler(mockEvent))
      expect(gtagSpy).toHaveBeenCalledWith(
        'event',
        'file_download',
        expect.objectContaining({
          file_name: 'report.pdf',
          file_type: 'pdf',
          send_to: 'G-XXXXX',
        }),
      )
    })

    it('should respect excludePatterns', () => {
      const config = { ga4: { measurementId: 'G-XXXXX' } }
      useAnalytics({
        config,
        excludePatterns: [/internal\.com/],
      })

      const clickHandlers = (document.addEventListener as any).mock.calls
        .filter((call: any) => call[0] === 'click')
        .map((call: any) => call[1])

      const mockEvent = {
        target: {
          closest: () => ({
            getAttribute: () => 'https://internal.com/page',
            hasAttribute: () => false,
          }),
        },
      }

      clickHandlers.forEach((handler: any) => handler(mockEvent))

      expect(gtagSpy).not.toHaveBeenCalledWith(
        'event',
        'external_link',
        expect.anything(),
      )
    })
  })
})
