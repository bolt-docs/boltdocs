import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useLocation } from './use-location'
import type { BoltdocsIntegrationsConfig } from '../../shared/types'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    dataLayer?: unknown[]
    gtag_report_conversion?: (url?: string) => boolean
  }
}

export interface AnalyticsEvent {
  action: string
  category?: string
  label?: string
  value?: number
  params?: Record<string, unknown>
}

export interface AnalyticsInstance {
  trackPageView: (path: string, title?: string) => void
  trackEvent: (event: AnalyticsEvent) => void
  trackSearch: (query: string, resultsCount?: number) => void
  trackDownload: (file: string, type?: string) => void
  trackExternalLink: (url: string) => void
  isEnabled: boolean
}

function createAnalyticsInstance(
  config?: BoltdocsIntegrationsConfig,
): AnalyticsInstance {
  if (typeof window === 'undefined') {
    return createDisabledAnalytics()
  }

  const isGtagAvailable = typeof window.gtag === 'function'

  if (isGtagAvailable) {
    return createGtagAnalytics(config)
  }

  if (window.dataLayer) {
    return createDataLayerAnalytics(config)
  }

  return createDisabledAnalytics()
}

function createGtagAnalytics(
  config?: BoltdocsIntegrationsConfig,
): AnalyticsInstance {
  return {
    trackPageView: (path: string, title?: string) => {
      window.gtag?.('event', 'page_view', {
        page_path: path,
        page_title: title || document.title,
        send_to: config?.ga4?.measurementId,
      })
    },
    trackEvent: ({ action, category, label, value, params }) => {
      window.gtag?.('event', action, {
        event_category: category,
        event_label: label,
        value,
        send_to: config?.ga4?.measurementId,
        ...params,
      })
    },
    trackSearch: (query: string, resultsCount?: number) => {
      window.gtag?.('event', 'search', {
        search_term: query,
        results_count: resultsCount,
        send_to: config?.ga4?.measurementId,
      })
    },
    trackDownload: (file: string, type?: string) => {
      window.gtag?.('event', 'file_download', {
        file_name: file,
        file_type: type || file.split('.').pop(),
        send_to: config?.ga4?.measurementId,
      })
    },
    trackExternalLink: (url: string) => {
      window.gtag?.('event', 'external_link', {
        link_url: url,
        send_to: config?.ga4?.measurementId,
      })
    },
    isEnabled: true,
  }
}

function createDataLayerAnalytics(
  config?: BoltdocsIntegrationsConfig,
): AnalyticsInstance {
  return {
    trackPageView: (path: string, title?: string) => {
      window.dataLayer?.push({
        event: 'page_view',
        page_path: path,
        page_title: title || document.title,
        send_to: config?.gtm?.tagId,
      })
    },
    trackEvent: ({ action, category, label, value, params }) => {
      window.dataLayer?.push({
        event: action,
        event_category: category,
        event_label: label,
        value,
        send_to: config?.gtm?.tagId,
        ...params,
      })
    },
    trackSearch: (query: string, resultsCount?: number) => {
      window.dataLayer?.push({
        event: 'search',
        search_term: query,
        results_count: resultsCount,
        send_to: config?.gtm?.tagId,
      })
    },
    trackDownload: (file: string, type?: string) => {
      window.dataLayer?.push({
        event: 'file_download',
        file_name: file,
        file_type: type || file.split('.').pop(),
        send_to: config?.gtm?.tagId,
      })
    },
    trackExternalLink: (url: string) => {
      window.dataLayer?.push({
        event: 'external_link',
        link_url: url,
        send_to: config?.gtm?.tagId,
      })
    },
    isEnabled: true,
  }
}

function createDisabledAnalytics(): AnalyticsInstance {
  return {
    trackPageView: () => {},
    trackEvent: () => {},
    trackSearch: () => {},
    trackDownload: () => {},
    trackExternalLink: () => {},
    isEnabled: false,
  }
}

export interface UseAnalyticsOptions {
  config?: BoltdocsIntegrationsConfig
  autoTrackPageViews?: boolean
  autoTrackDownloads?: boolean
  autoTrackExternalLinks?: boolean
  excludePatterns?: RegExp[]
}

const CONFIG_INSTANCE_SYMBOL = Symbol.for('__BDOCS_CONFIG_INSTANCE__')

export function useAnalytics(options: UseAnalyticsOptions = {}) {
  const {
    config: optionsConfig,
    autoTrackPageViews = true,
    autoTrackDownloads = true,
    autoTrackExternalLinks = true,
    excludePatterns = [],
  } = options

  const globalConfig =
    typeof globalThis !== 'undefined'
      ? ((globalThis as any)[CONFIG_INSTANCE_SYMBOL] as
          | { integrations?: BoltdocsIntegrationsConfig }
          | undefined)
      : undefined
  const config = optionsConfig ?? globalConfig?.integrations

  const analytics = useMemo(() => createAnalyticsInstance(config), [config])

  const previousPath = useRef<string>('')
  const location = useLocation()

  useEffect(() => {
    if (!autoTrackPageViews || !analytics.isEnabled) return

    const path = location.pathname + location.search

    if (path !== previousPath.current) {
      previousPath.current = path
      analytics.trackPageView(path, document.title)
    }
  }, [location.pathname, autoTrackPageViews, analytics])

  useEffect(() => {
    if (!autoTrackDownloads || !analytics.isEnabled) return

    const handleClick = (event: MouseEvent) => {
      const target = (event.target as Element)?.closest('a')
      if (!target) return

      const href = target.getAttribute('href')
      if (!href) return

      if (excludePatterns.some((pattern) => pattern.test(href))) return

      const isDownload =
        target.hasAttribute('download') ||
        /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|7z|tar|gz|mp3|mp4|avi|mov|png|jpg|jpeg|gif|svg|webp)$/i.test(
          href,
        )

      if (isDownload) {
        const fileName = href.split('/').pop() || href
        analytics.trackDownload(fileName, fileName.split('.').pop())
      }
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [autoTrackDownloads, autoTrackExternalLinks, analytics, excludePatterns])

  useEffect(() => {
    if (!autoTrackExternalLinks || !analytics.isEnabled) return

    const handleClick = (event: MouseEvent) => {
      const target = (event.target as Element)?.closest('a')
      if (!target) return

      const href = target.getAttribute('href')
      if (!href) return

      if (excludePatterns.some((pattern) => pattern.test(href))) return

      const isExternal =
        href.startsWith('http://') ||
        href.startsWith('https://') ||
        href.startsWith('//')

      if (isExternal && !href.includes(window.location.hostname)) {
        analytics.trackExternalLink(href)
      }
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [autoTrackExternalLinks, analytics, excludePatterns])

  return analytics
}

export function useTrackPageView() {
  const analytics = useMemo(() => createAnalyticsInstance(), [])
  return useCallback(
    (path: string, title?: string) => {
      analytics.trackPageView(path, title)
    },
    [analytics],
  )
}

export function useTrackEvent() {
  const analytics = useMemo(() => createAnalyticsInstance(), [])
  return useCallback(
    (event: AnalyticsEvent) => {
      analytics.trackEvent(event)
    },
    [analytics],
  )
}
