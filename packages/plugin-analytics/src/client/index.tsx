import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react'
import type { BoltdocsAnalyticsConfig } from 'boltdocs/node/schema/config'

export interface AnalyticsEvent {
  action: string
  category?: string
  label?: string
  value?: number
  params?: Record<string, unknown>
}

export interface Analytics {
  trackPageView: (path: string, title?: string) => void
  trackEvent: (event: AnalyticsEvent) => void
  trackSearch: (query: string, resultsCount?: number) => void
  trackDownload: (file: string, type?: string) => void
  trackExternalLink: (url: string) => void
  isEnabled: boolean
}

interface AnalyticsContextValue {
  config: BoltdocsAnalyticsConfig | undefined
  analytics: Analytics
}

const AnalyticsContext = createContext<AnalyticsContextValue | null>(null)

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    dataLayer?: unknown[]
  }
}

function getAnalytics(): Analytics | null {
  if (typeof window === 'undefined') return null

  if (window.gtag) {
    return {
      trackPageView: (path: string, title?: string) => {
        window.gtag?.('event', 'page_view', {
          page_path: path,
          page_title: title || document.title,
        })
      },
      trackEvent: ({ action, category, label, value, params }) => {
        const eventParams: Record<string, unknown> = {
          event_category: category,
          event_label: label,
          value,
          ...params,
        }
        window.gtag?.('event', action, eventParams)
      },
      trackSearch: (query: string, resultsCount?: number) => {
        window.gtag?.('event', 'search', {
          search_term: query,
          results_count: resultsCount,
        })
      },
      trackDownload: (file: string, type?: string) => {
        window.gtag?.('event', 'file_download', {
          file_name: file,
          file_type: type,
        })
      },
      trackExternalLink: (url: string) => {
        window.gtag?.('event', 'external_link', {
          link_url: url,
        })
      },
      isEnabled: true,
    }
  }

  if (window.dataLayer) {
    return {
      trackPageView: (path: string, title?: string) => {
        window.dataLayer?.push({
          event: 'page_view',
          page_path: path,
          page_title: title || document.title,
        })
      },
      trackEvent: ({ action, category, label, value, params }) => {
        window.dataLayer?.push({
          event: action,
          event_category: category,
          event_label: label,
          value,
          ...params,
        })
      },
      trackSearch: (query: string, resultsCount?: number) => {
        window.dataLayer?.push({
          event: 'search',
          search_term: query,
          results_count: resultsCount,
        })
      },
      trackDownload: (file: string, type?: string) => {
        window.dataLayer?.push({
          event: 'file_download',
          file_name: file,
          file_type: type,
        })
      },
      trackExternalLink: (url: string) => {
        window.dataLayer?.push({
          event: 'external_link',
          link_url: url,
        })
      },
      isEnabled: true,
    }
  }

  return null
}

export interface AnalyticsProviderProps {
  children: React.ReactNode
  config: BoltdocsAnalyticsConfig | undefined
  autoTrackPageViews?: boolean
  autoTrackDownloads?: boolean
  autoTrackExternalLinks?: boolean
  excludePatterns?: RegExp[]
}

export function AnalyticsProvider({
  children,
  config,
  autoTrackPageViews = true,
  autoTrackDownloads = true,
  autoTrackExternalLinks = true,
  excludePatterns = [],
}: AnalyticsProviderProps) {
  const analytics = useMemo(() => getAnalytics() || {
    trackPageView: () => {},
    trackEvent: () => {},
    trackSearch: () => {},
    trackDownload: () => {},
    trackExternalLink: () => {},
    isEnabled: false,
  }, [])

  const previousPath = useRef<string>('')

  useEffect(() => {
    if (!autoTrackPageViews || !analytics.isEnabled) return

    const handleRouteChange = () => {
      const path = window.location.pathname + window.location.search
      const title = document.title

      if (path !== previousPath.current) {
        previousPath.current = path
        analytics.trackPageView(path, title)
      }
    }

    const observer = new MutationObserver(handleRouteChange)
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    })

    window.addEventListener('popstate', handleRouteChange)

    handleRouteChange()

    return () => {
      observer.disconnect()
      window.removeEventListener('popstate', handleRouteChange)
    }
  }, [autoTrackPageViews, analytics])

  useEffect(() => {
    if (!autoTrackDownloads || !analytics.isEnabled) return

    const handleClick = (event: MouseEvent) => {
      const target = (event.target as Element)?.closest('a')
      if (!target) return

      const href = target.getAttribute('href')
      if (!href) return

      if (excludePatterns.some((pattern) => pattern.test(href))) return

      const isExternal = href.startsWith('http') || href.startsWith('//')
      const isDownload = target.hasAttribute('download') ||
        /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|7z|tar|gz|mp3|mp4|avi|mov|png|jpg|jpeg|gif|svg)$/i.test(href)

      if (isDownload) {
        const fileName = href.split('/').pop() || href
        analytics.trackDownload(fileName, fileName.split('.').pop())
      } else if (isExternal) {
        analytics.trackExternalLink(href)
      }
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [autoTrackDownloads, autoTrackExternalLinks, analytics, excludePatterns])

  const value = useMemo(
    () => ({
      config,
      analytics,
    }),
    [config, analytics],
  )

  return (
    <AnalyticsContext.Provider value={value}>
      {children}
    </AnalyticsContext.Provider>
  )
}

export function useAnalytics(): Analytics {
  const context = useContext(AnalyticsContext)
  if (!context) {
    return {
      trackPageView: () => {},
      trackEvent: () => {},
      trackSearch: () => {},
      trackDownload: () => {},
      trackExternalLink: () => {},
      isEnabled: false,
    }
  }
  return context.analytics
}

export function useTrackPageView() {
  const analytics = useAnalytics()
  return useCallback(
    (path: string, title?: string) => {
      analytics.trackPageView(path, title)
    },
    [analytics],
  )
}

export function useTrackEvent() {
  const analytics = useAnalytics()
  return useCallback(
    (event: AnalyticsEvent) => {
      analytics.trackEvent(event)
    },
    [analytics],
  )
}