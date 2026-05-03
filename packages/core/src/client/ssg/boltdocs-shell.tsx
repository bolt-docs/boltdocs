import { useEffect, useMemo } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BoltdocsProvider, useBoltdocsContext } from '../store/boltdocs-context'
import { ThemeProvider } from '../app/theme-context'
import { MdxComponentsProvider } from '../app/mdx-components-context'
import * as ReactHelmetAsync from 'react-helmet-async'
import { ConfigContext } from '../app/config-context'
import { ScrollHandler } from '../app/scroll-handler'
import { mdxComponentsDefault } from '../app/mdx-component'
import { RoutesProvider } from '../app/routes-context'
import type { BoltdocsConfig } from '../../shared/types'
import type { ComponentRoute } from '../types'

import virtualCustomComponents from 'virtual:boltdocs-mdx-components'

type HelmetProviderModule = {
  HelmetProvider?: ComponentType<{ children?: ReactNode }>
  default?: { HelmetProvider?: ComponentType<{ children?: ReactNode }> }
}
const helmetProviderModule = ReactHelmetAsync as unknown as HelmetProviderModule
const HelmetProvider =
  helmetProviderModule.HelmetProvider
  || helmetProviderModule.default?.HelmetProvider
  || (({ children }) => <>{children}</>)

/**
 * Updates the HTML lang and dir attributes based on the current locale configuration.
 */
function I18nUpdater({ config }: { config: BoltdocsConfig }) {
  const { currentLocale } = useBoltdocsContext()

  useEffect(() => {
    if (!config.i18n || typeof document === 'undefined') return
    const locale = currentLocale || config.i18n.defaultLocale
    const localeConfig = config.i18n.localeConfigs?.[locale]
    document.documentElement.lang = localeConfig?.htmlLang || locale || 'en'
    document.documentElement.dir = localeConfig?.direction || 'ltr'
  }, [currentLocale, config.i18n])

  return null
}

/**
 * Synchronizes the Zustand store with the current URL pathname.
 */
function StoreSync({ config }: { config: BoltdocsConfig }) {
  const location = useLocation()
  const { setLocale, setVersion, currentLocale, currentVersion } =
    useBoltdocsContext()

  useEffect(() => {
    const parts = location.pathname.split('/').filter(Boolean)
    let cIdx = 0
    let detectedVersion = config.versions?.defaultVersion
    let detectedLocale = config.i18n?.defaultLocale

    // 0. Skip docs prefix if present
    if (parts[cIdx] === 'docs') cIdx++

    // 1. Version detection
    if (config.versions && parts.length > cIdx) {
      const versionMatch = config.versions.versions.find(
        (v) => v.path === parts[cIdx],
      )
      if (versionMatch) {
        detectedVersion = versionMatch.path
        cIdx++
      }
    }

    // 2. Locale detection
    if (config.i18n && parts.length > cIdx) {
      const potentialLocale = parts[cIdx]
      const isLocale = Array.isArray(config.i18n.locales)
        ? config.i18n.locales.includes(potentialLocale)
        : !!config.i18n.locales[potentialLocale]

      if (isLocale) {
        detectedLocale = potentialLocale
      }
    } else if (config.i18n && parts.length === 0) {
      detectedLocale = currentLocale || config.i18n.defaultLocale
    }

    if (detectedLocale !== currentLocale) setLocale(detectedLocale || '')
    if (detectedVersion !== currentVersion) setVersion(detectedVersion ?? '')
  }, [
    location.pathname,
    config,
    setLocale,
    setVersion,
    currentLocale,
    currentVersion,
  ])

  return null
}

export function BoltdocsShell({
  config,
  routes,
  components = {},
}: {
  config: BoltdocsConfig
  routes: ComponentRoute[]
  components?: Record<string, React.ComponentType>
}) {
  const allComponents = useMemo(
    () => ({
      ...mdxComponentsDefault,
      ...virtualCustomComponents,
      ...components,
    }),
    [components],
  )

  const { pathname } = useLocation()
  
  const currentPath = useMemo(() => {
    const p = pathname || '/'
    return p.endsWith('/') && p.length > 1 ? p.slice(0, -1) : p
  }, [pathname])

  const currentRoute = useMemo(() => 
    routes.find((r) => {
      const rp = r.path === '' ? '/' : r.path
      const normalize = (path: string) => path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path
      return normalize(rp) === currentPath
    }),
    [routes, currentPath]
  )

  return (
    <HelmetProvider>
      <RoutesProvider routes={routes}>
        <ThemeProvider>
          <MdxComponentsProvider components={allComponents}>
            <ConfigContext.Provider value={config}>
              <ScrollHandler />
              <BoltdocsProvider
                initialLocale={currentRoute?.locale}
                initialVersion={currentRoute?.version}
              >
                <StoreSync config={config} />
                <I18nUpdater config={config} />
                <Outlet />
              </BoltdocsProvider>
            </ConfigContext.Provider>
          </MdxComponentsProvider>
        </ThemeProvider>
      </RoutesProvider>
    </HelmetProvider>
  )
}
