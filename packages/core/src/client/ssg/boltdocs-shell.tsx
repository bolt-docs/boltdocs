import { useEffect, useMemo } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { BoltdocsProvider, useBoltdocsContext } from '../store/boltdocs-context'
import { ThemeProvider } from '../app/theme-context'
import { MdxComponentsProvider } from '../app/mdx-components-context'
import { HelmetProvider } from '../app/helmet-compat'
import { ConfigContext } from '../app/config-context'
import { ScrollHandler } from '../app/scroll-handler'
import { mdxComponentsDefault } from '../app/mdx-component'
import { RoutesProvider } from '../app/routes-context'
import type { BoltdocsConfig } from '../../shared/types'
import type { ComponentRoute } from '../types'
import { UIProvider } from '../app/ui-context'

import virtualCustomComponents from 'virtual:boltdocs-mdx-components'

/** Normalize a path: strip trailing slash unless it is exactly '/'. */
function normalizePath(p: string): string {
  return p.endsWith('/') && p.length > 1 ? p.slice(0, -1) : p
}

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
 * Receives a pre-built Map for O(1) route lookups instead of O(n) .find().
 */
function StoreSync({
  config,
  routeMap,
}: {
  config: BoltdocsConfig
  routeMap: Map<string, ComponentRoute>
}) {
  const location = useLocation()
  const { setLocale, setVersion } = useBoltdocsContext()

  useEffect(() => {
    const currentPath = normalizePath(location.pathname)
    const matchedRoute = routeMap.get(currentPath)

    if (matchedRoute) {
      if (config.i18n) {
        const targetLocale = matchedRoute.locale || config.i18n.defaultLocale
        setLocale(targetLocale)
      }
      if (config.versions) {
        const targetVersion =
          matchedRoute.version || config.versions.defaultVersion
        setVersion(targetVersion)
      }
    }
  }, [location.pathname, config, routeMap, setLocale, setVersion])

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

  const currentPath = useMemo(() => normalizePath(pathname || '/'), [pathname])

  // Build a single O(1) lookup Map from the routes array.
  // This replaces the 3 separate O(n) .find() calls that previously ran on every render.
  const routeMap = useMemo(() => {
    const map = new Map<string, ComponentRoute>()
    for (const r of routes) {
      const key = normalizePath(r.path === '' ? '/' : r.path)
      map.set(key, r)
    }
    return map
  }, [routes])

  // Calculate frame-perfect initial values derived AUTHORITATIVELY from the static route match
  const initialData = useMemo(() => {
    const matched = routeMap.get(currentPath)

    let initLocale = undefined
    let initVersion = undefined

    if (matched) {
      if (config.i18n) {
        initLocale = matched.locale || config.i18n.defaultLocale
      }
      if (config.versions) {
        initVersion = matched.version || config.versions.defaultVersion
      }
    }

    return { initLocale, initVersion }
  }, [currentPath, config, routeMap])

  return (
    <HelmetProvider>
      <RoutesProvider routes={routes}>
        <ThemeProvider>
          <UIProvider>
            <MdxComponentsProvider components={allComponents}>
              <ConfigContext.Provider value={config}>
                <ScrollHandler />
                <BoltdocsProvider
                  initialLocale={initialData.initLocale}
                  initialVersion={initialData.initVersion}
                >
                  <StoreSync config={config} routeMap={routeMap} />
                  <I18nUpdater config={config} />
                  <Outlet />
                </BoltdocsProvider>
              </ConfigContext.Provider>
            </MdxComponentsProvider>
          </UIProvider>
        </ThemeProvider>
      </RoutesProvider>
    </HelmetProvider>
  )
}
