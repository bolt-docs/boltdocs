import { describe, it, expect, vi, afterEach } from 'vitest'
import { injectHtmlMeta } from '../../src/node/plugin/html'

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

describe('Analytics integration (node side)', () => {
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
          analytics: {
            ga4: {
              measurementId: 'G-XXXXX',
              anonymizeIp: true,
              sendPageView: false,
              cookieFlags: 'SameSite=None;Secure',
            },
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
          analytics: {
            gtm: {
              tagId: 'GTM-XXXXX',
              dataLayerName: 'customDL',
              preview: 'env-1',
            },
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
})
