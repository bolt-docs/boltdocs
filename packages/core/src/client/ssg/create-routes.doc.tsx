import type { RouteRecord } from '../router'
import type { ComponentRoute, BoltdocsConfig } from '../types'
import {
  EagerMdxElement,
  resolveModuleLoader,
  type MdxModule,
} from './mdx-elements'
import {
  buildModuleMap,
  resolveModuleKey,
  withBase,
} from './create-routes.utils'
import { buildUrl, parseUrlReference } from '../router'

function FallbackWrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

function buildDocRoutes(options: {
  routesData: ComponentRoute[]
  config: BoltdocsConfig
  mdxModules: Record<string, unknown>
  components?: Record<string, React.ComponentType>
  externalPages?: Record<string, React.ComponentType>
}): { routes: RouteRecord[]; metadata: ComponentRoute[] } {
  const { routesData, config, mdxModules, components, externalPages } = options

  const baseDocsPath = (config.base || '/docs').replace(/\/$/, '') || '/'

  const defaultVersionMetadata: ComponentRoute[] = []
  const defaultVersion = config.versions?.defaultVersion
  const docsBase = (config.base || '/docs').replace(/\/$/, '')
  const urlConfig = {
    base: config.base,
    i18n: config.i18n,
    versions: config.versions,
    collections: [],
  }

  if (defaultVersion) {
    routesData
      .filter((r) => !r.collection)
      .forEach((route) => {
        if (route.version) return
        const p = route.path || ''
        const subPath = p.startsWith(docsBase)
          ? p.substring(docsBase.length).replace(/^\//, '')
          : p.replace(/^\//, '')
        const hasVersionPrefix = route.version === defaultVersion
        if (!hasVersionPrefix) {
          const explicitPath = buildUrl(
            {
              kind: 'doc',
              path: `/${subPath}`,
              locale: route.locale,
              version: defaultVersion,
            },
            urlConfig,
          )
          defaultVersionMetadata.push({
            ...route,
            path: explicitPath,
            version: defaultVersion,
          })
        }
      })
  }

  const docRoutesData = routesData.filter((r) => !r.collection)
  const docMetadata = [...docRoutesData, ...defaultVersionMetadata]
  const moduleMap = buildModuleMap(mdxModules)
  const routeMetadata = new Map<RouteRecord, ComponentRoute>()

  const getDocumentIdentity = (route: ComponentRoute) => {
    const parsed = parseUrlReference(route.path, urlConfig, { kind: 'doc' })
    return {
      path: parsed.routePath,
      version:
        route.version || parsed.version || config.versions?.defaultVersion,
    }
  }

  const docRoutes: RouteRecord[] = docMetadata.map((route) => {
    const moduleKey = resolveModuleKey(route.filePath, moduleMap)
    const moduleLoader = moduleKey ? mdxModules[moduleKey] : null
    const fullPath = withBase(route.path === '' ? '/' : route.path, config)
    const path =
      fullPath === baseDocsPath
        ? '.'
        : fullPath.startsWith(baseDocsPath + '/')
          ? fullPath.slice(baseDocsPath.length + 1)
          : fullPath

    const routeRecord: RouteRecord = {
      path,
      locale: route.locale,
      loader: async () => ({
        path,
        frontmatter: {
          title: route.title,
          description: route.description || '',
          ...(route.frontmatter || {}),
        },
        seo: route.seo,
        headings: route.headings || [],
        filePath: route.filePath,
        locale: route.locale,
        version: route.version,
        group: route.group,
        groupTitle: route.groupTitle,
        date: route.date,
        lastUpdated: route.lastUpdated,
      }),
      getStaticPaths: () => [path],
    }

    routeMetadata.set(routeRecord, route)

    if (moduleLoader) {
      routeRecord.lazy = async () => {
        const mod: MdxModule = (await resolveModuleLoader(
          moduleLoader as unknown as MdxModule,
        )) as MdxModule
        return {
          Component: function LoadedMdxRoute() {
            return (
              <EagerMdxElement
                key={`${moduleKey || path}-${route.locale || config.i18n?.defaultLocale || 'en'}`}
                moduleKey={moduleKey}
                moduleLoader={mod as unknown as MdxModule}
                route={route}
                components={
                  (components ?? {}) as Record<string, React.ComponentType>
                }
              />
            )
          },
        }
      }
    } else {
      routeRecord.element = (
        <EagerMdxElement
          key={`${moduleKey || path}-${route.locale || config.i18n?.defaultLocale || 'en'}`}
          moduleKey={moduleKey}
          moduleLoader={(moduleLoader ?? {}) as unknown as MdxModule}
          route={route}
          components={(components ?? {}) as Record<string, React.ComponentType>}
        />
      )
    }

    return routeRecord
  })

  const locales = config.i18n?.locales
    ? Array.isArray(config.i18n.locales)
      ? config.i18n.locales
      : Object.keys(config.i18n.locales)
    : []

  const allVersions = config.versions?.versions?.map((v) => v.path) || []

  const targetBasePaths: Array<{
    path: string
    locale?: string
    version?: string
  }> = []

  const addTargetBase = (locale?: string, version?: string) => {
    const fullPath = buildUrl(
      { kind: 'doc', path: '/', locale, version },
      urlConfig,
    )
    targetBasePaths.push({
      path: fullPath,
      locale,
      version,
    })
  }

  addTargetBase(config.i18n?.defaultLocale)
  for (const version of allVersions) {
    addTargetBase(config.i18n?.defaultLocale, version)
  }
  for (const locale of locales) {
    addTargetBase(locale)
  }
  for (const version of allVersions) {
    for (const locale of locales) {
      addTargetBase(locale, version)
    }
  }

  const docPathRegistry = new Set(
    docRoutes.map((r) => (r.path || '').replace(/\/$/, '')),
  )

  const externalPaths = new Set<string>()
  if (externalPages) {
    Object.keys(externalPages).forEach((rawPath) => {
      const p = rawPath.startsWith('/') ? rawPath : `/${rawPath}`
      externalPaths.add(p.replace(/\/$/, ''))
      if (config.i18n) {
        const locales = Array.isArray(config.i18n.locales)
          ? config.i18n.locales
          : Object.keys(config.i18n.locales)
        locales.forEach((locale) => {
          externalPaths.add(
            `/${locale}${p === '/' ? '' : p}`.replace(/\/$/, ''),
          )
        })
      }
    })
  }

  targetBasePaths.forEach(
    ({ path: bPath, locale: bLocale, version: bVersion }) => {
      if (bPath === '/') return

      const normalizedPath = bPath.replace(/\/$/, '')
      const hasExplicitMatch =
        docPathRegistry.has(normalizedPath) || externalPaths.has(normalizedPath)

      if (!hasExplicitMatch) {
        const defaultTab = config.theme?.tabs?.[0]?.id
        const defaultTabPath = defaultTab
          ? `${normalizedPath}/${defaultTab}`.replace(/\/+/g, '/')
          : null

        // `docRoutes` use paths relative to the `/docs` parent while the
        // metadata keeps absolute public paths. Compare fallback candidates
        // against metadata so the docs root can reliably choose tab #1.
        let matchedRouteObj: RouteRecord | undefined = defaultTabPath
          ? docRoutes.find((r) => {
              const meta = routeMetadata.get(r)
              return (
                meta?.path?.replace(/\/$/, '') ===
                defaultTabPath.replace(/\/$/, '')
              )
            })
          : undefined

        if (!matchedRouteObj) {
          matchedRouteObj = docRoutes.find((r) => {
            const meta = routeMetadata.get(r)
            const routePath = meta?.path?.replace(/\/$/, '')
            return (
              !!routePath &&
              (routePath === normalizedPath ||
                routePath.startsWith(`${normalizedPath}/`))
            )
          })
        }

        if (!matchedRouteObj && docRoutes.length > 0) {
          matchedRouteObj = docRoutes[0]
        }

        // Prefer the route whose source file is the translated counterpart of
        // the matched route so that a locale base path (e.g. /docs/es) renders
        // content in the correct language.
        if (matchedRouteObj && bLocale) {
          const localeBaseRoute = matchedRouteObj
          const defaultLocale = config.i18n?.defaultLocale
          const matchedMeta = routeMetadata.get(localeBaseRoute)
          const matchedIdentity = matchedMeta
            ? getDocumentIdentity(matchedMeta)
            : undefined

          const localeMatch = docRoutes.find((r) => {
            const meta = routeMetadata.get(r)
            if (!meta || !matchedIdentity) return false
            const isTargetLocale =
              meta.locale === bLocale ||
              (bLocale === defaultLocale && !meta.locale)
            if (!isTargetLocale) return false
            const identity = getDocumentIdentity(meta)
            return (
              identity.path === matchedIdentity.path &&
              identity.version === (bVersion || config.versions?.defaultVersion)
            )
          })

          if (localeMatch) {
            matchedRouteObj = localeMatch
          }
        }

        if (matchedRouteObj) {
          const matchedRoute = matchedRouteObj
          const redirectPath =
            bPath === baseDocsPath
              ? '.'
              : bPath.startsWith(baseDocsPath + '/')
                ? bPath.slice(baseDocsPath.length + 1)
                : bPath

          const isBasePathFallback = redirectPath === '.'

          // Build metadata for this fallback up-front so the rendered element
          // receives the correct locale/version and path context. Prefer the
          // metadata that corresponds to the target locale.
          const matchedMetaObj = (() => {
            const matchedMeta = routeMetadata.get(matchedRoute)
            if (!matchedMeta) return undefined

            const matchedIdentity = getDocumentIdentity(matchedMeta)
            const targetVersion = bVersion || config.versions?.defaultVersion
            const targetLocale = bLocale || config.i18n?.defaultLocale

            return (
              docMetadata.find((m) => {
                const identity = getDocumentIdentity(m)
                const locale = m.locale || config.i18n?.defaultLocale
                return (
                  identity.path === matchedIdentity.path &&
                  locale === targetLocale &&
                  identity.version === targetVersion
                )
              }) || matchedMeta
            )
          })()

          const fallbackMetaObj: ComponentRoute = matchedMetaObj
            ? {
                ...matchedMetaObj,
                path: bPath,
                filePath: matchedMetaObj.filePath,
                locale: bLocale,
                version: bVersion,
                slugParts: [],
                fallback: true,
                seo: {
                  ...matchedMetaObj.seo,
                  canonical: config.siteUrl
                    ? `${config.siteUrl.replace(/\/$/, '')}${withBase(bPath, config)}`
                    : withBase(bPath, config),
                },
              }
            : ({
                path: bPath,
                filePath: '',
                title: redirectPath,
                componentPath: '',
                headings: [],
                locale: bLocale,
                version: bVersion,
                fallback: true,
              } as unknown as ComponentRoute)

          // Never share the matched route's element/lazy directly — that causes
          // React to reuse the same component instance and can pin the wrong
          // locale content. Build a fresh lazy wrapper per fallback route so
          // each base-path (locale/version) entry gets its own route record.
          const fallbackRoute: RouteRecord = {
            ...(isBasePathFallback
              ? { index: true as const }
              : { path: redirectPath }),
            locale: bLocale,
            loader: matchedRoute.loader,
            getStaticPaths: () => [],
          }

          const resolveFallbackComponent = async () => {
            const moduleKey = resolveModuleKey(
              fallbackMetaObj.filePath,
              moduleMap,
            )
            const moduleLoader = moduleKey ? mdxModules[moduleKey] : null
            const localeKey = bLocale || config.i18n?.defaultLocale || 'en'
            const key = `${moduleKey || bPath}-${localeKey}`

            if (!moduleLoader) return null

            const module = await resolveModuleLoader(
              moduleLoader as unknown as MdxModule,
            )
            return (
              <EagerMdxElement
                key={key}
                moduleKey={moduleKey}
                moduleLoader={module}
                route={fallbackMetaObj}
                components={
                  (components ?? {}) as Record<string, React.ComponentType>
                }
              />
            )
          }

          if (matchedRoute.lazy) {
            fallbackRoute.lazy = async () => {
              const fallbackComponent = await resolveFallbackComponent()
              return {
                Component: () => (
                  <FallbackWrapper>{fallbackComponent}</FallbackWrapper>
                ),
              }
            }
          } else if (matchedRoute.element) {
            fallbackRoute.element = matchedRoute.element
          }

          fallbackRoute.loader = async () => ({
            path: redirectPath,
            frontmatter: {
              title: fallbackMetaObj.title,
              description: fallbackMetaObj.description || '',
              ...(fallbackMetaObj.frontmatter || {}),
            },
            seo: fallbackMetaObj.seo,
            headings: fallbackMetaObj.headings || [],
            filePath: fallbackMetaObj.filePath,
            locale: fallbackMetaObj.locale,
            version: fallbackMetaObj.version,
            group: fallbackMetaObj.group,
            groupTitle: fallbackMetaObj.groupTitle,
            date: fallbackMetaObj.date,
            lastUpdated: fallbackMetaObj.lastUpdated,
          })

          docRoutes.push(fallbackRoute)
          docMetadata.push(fallbackMetaObj)
        }
      }
    },
  )

  return { routes: docRoutes, metadata: docMetadata }
}

export { buildDocRoutes }
