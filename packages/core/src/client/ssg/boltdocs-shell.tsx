import { useEffect, useMemo } from 'react'
import { Outlet, useLocation } from '../router'
import { BoltdocsProvider, useBoltdocsContext } from '../store/boltdocs-context'
import { ThemeProvider } from '../app/theme-context'
import { MdxComponentsProvider } from '../app/mdx-components-context'
import { ConfigContext } from '../app/config-context'
import { ScrollHandler } from '../app/scroll-handler'
import { mdxComponentsDefault } from '../app/mdx-component'
import { RoutesProvider } from '../app/routes-context'
import type { BoltdocsConfig } from '../../shared/types'
import type { ComponentRoute } from '../types'
import { UIProvider } from '../app/ui-context'
import { Head } from '../app/head'
import { Helmet } from '../app/helmet-compat'
import { InternalErrorBoundary as ErrorBoundary } from '../components/internal/error-boundary'
import { CollectionsProvider } from '../collections/collections-context'
import type { CollectionsData } from '../collections/collections-context'

import virtualCustomComponents from 'virtual:boltdocs-mdx-components'
import { normalizePath } from '../utils/path'

/**
 * Updates the HTML lang and dir attributes based on the current locale configuration.
 */
function I18nUpdater({ config }: { config: BoltdocsConfig }) {
  const { currentLocale } = useBoltdocsContext()
  const locale = currentLocale || config.i18n?.defaultLocale || 'en'
  const localeConfig = config.i18n?.localeConfigs?.[locale]
  const htmlLang = localeConfig?.htmlLang || locale
  const direction = localeConfig?.direction || 'ltr'

  useEffect(() => {
    if (!config.i18n || typeof document === 'undefined') return
    document.documentElement.lang = htmlLang
    document.documentElement.dir = direction
  }, [config.i18n, direction, htmlLang])

  return <Helmet htmlAttributes={{ lang: htmlLang, dir: direction }} />
}

// synchronizes store with current URL pathname
function StoreSync({
  config,
  routeMap,
}: {
  config: BoltdocsConfig
  routeMap: Map<string, ComponentRoute>
}) {
  const location = useLocation()
  const { currentLocale, currentVersion, setLocale, setVersion } =
    useBoltdocsContext()

  useEffect(() => {
    const currentPath = normalizePath(location.pathname)
    const matchedRoute = routeMap.get(currentPath)

    if (matchedRoute) {
      if (config.i18n) {
        const targetLocale = matchedRoute.locale || config.i18n.defaultLocale
        if (targetLocale !== currentLocale) setLocale(targetLocale)
      }
      if (config.versions) {
        const targetVersion =
          matchedRoute.version || config.versions.defaultVersion
        if (targetVersion !== currentVersion) setVersion(targetVersion)
      }
    } else if (
      config.versions &&
      currentVersion !== config.versions.defaultVersion
    ) {
      // Reset an invalid persisted preference only once when entering an
      // unmatched route; avoid a redundant localStorage write on every render.
      setVersion(config.versions.defaultVersion)
    }
  }, [
    location.pathname,
    config,
    routeMap,
    currentLocale,
    currentVersion,
    setLocale,
    setVersion,
  ])

  return null
}

export function BoltdocsShell({
  config,
  routes,
  components = {},
  collectionsData,
}: {
  config: BoltdocsConfig
  routes: ComponentRoute[]
  components?: Record<string, React.ComponentType>
  collectionsData?: CollectionsData
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

  const routeMap = useMemo(() => {
    const map = new Map<string, ComponentRoute>()
    for (const r of routes) {
      const key = normalizePath(r.path === '' ? '/' : r.path)
      map.set(key, r)
    }
    return map
  }, [routes])

  const initialData = useMemo(() => {
    const matched = routeMap.get(currentPath)

    let initLocale: string | undefined
    let initVersion: string | undefined

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
    <RoutesProvider routes={routes}>
      <ThemeProvider>
        <UIProvider>
          <MdxComponentsProvider components={allComponents}>
            <ConfigContext.Provider value={config}>
              <CollectionsProvider collectionsData={collectionsData || {}}>
                <ScrollHandler />
                <BoltdocsProvider
                  initialLocale={initialData.initLocale}
                  initialVersion={initialData.initVersion}
                >
                  <StoreSync config={config} routeMap={routeMap} />
                  <I18nUpdater config={config} />
                  <Head
                    siteTitle={config.theme?.title}
                    siteDescription={config.theme?.description}
                    routes={routes}
                  />
                  <ErrorBoundary>
                    <div className="boltdocs-shell-content h-screen overflow-hidden">
                      <Outlet />
                    </div>
                  </ErrorBoundary>
                </BoltdocsProvider>
              </CollectionsProvider>
            </ConfigContext.Provider>
          </MdxComponentsProvider>
        </UIProvider>
      </ThemeProvider>
    </RoutesProvider>
  )
}
