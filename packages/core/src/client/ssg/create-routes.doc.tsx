import type { RouteRecord } from '@bdocs/ssg'
import type { ComponentRoute, BoltdocsConfig } from '../types'
import { EagerMdxElement, resolveModuleLoader } from './mdx-elements'
import { buildModuleMap, withBase } from './create-routes.utils'

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

  if (defaultVersion) {
    routesData
      .filter((r) => !r.collection)
      .forEach((route) => {
        if (route.version) return
        const p = route.path || ''
        const subPath = p.startsWith(docsBase)
          ? p.substring(docsBase.length).replace(/^\//, '')
          : p.replace(/^\//, '')
        const hasVersionPrefix =
          subPath === defaultVersion || subPath.startsWith(`${defaultVersion}/`)
        if (!hasVersionPrefix) {
          const explicitPath =
            `${docsBase}/${defaultVersion}/${subPath}`
              .replace(/\/+/g, '/')
              .replace(/\/$/, '') || '/'
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

  const mdxModuleKeys = Object.keys(mdxModules)
  const isLazy =
    mdxModuleKeys.length > 0 &&
    typeof mdxModules[mdxModuleKeys[0]] === 'function'

  const docRoutes: RouteRecord[] = docMetadata.map((route) => {
    const normalizedFilePath = route.filePath.replace(/\\/g, '/')
    const moduleKey = moduleMap.get(normalizedFilePath)
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

    if (isLazy && moduleLoader) {
      routeRecord.lazy = async () => {
        const mod = await resolveModuleLoader(moduleLoader)
        return {
          Component: function LoadedMdxRoute() {
            return (
              <EagerMdxElement
                key={moduleKey || path}
                moduleKey={moduleKey}
                moduleLoader={mod}
                route={route}
                components={components}
              />
            )
          },
        }
      }
    } else {
      routeRecord.element = (
        <EagerMdxElement
          key={moduleKey || path}
          moduleKey={moduleKey}
          moduleLoader={moduleLoader as any}
          route={route}
          components={components}
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
    filter: (p?: string) => boolean
    locale?: string
    version?: string
  }> = []

  targetBasePaths.push({
    path: baseDocsPath,
    filter: () => true,
    locale: config.i18n?.defaultLocale,
    version: config.versions?.defaultVersion,
  })

  if (allVersions.length > 0) {
    allVersions.forEach((v) => {
      const fullP = baseDocsPath === '/' ? `/${v}` : `${baseDocsPath}/${v}`
      targetBasePaths.push({
        path: fullP,
        filter: (rp) => !!rp && rp.startsWith(fullP.replace(/\/$/, '') + '/'),
        locale: config.i18n?.defaultLocale,
        version: v,
      })
    })
  }
  if (locales.length > 0) {
    locales.forEach((l) => {
      const fullP = baseDocsPath === '/' ? `/${l}` : `${baseDocsPath}/${l}`
      targetBasePaths.push({
        path: fullP,
        filter: (rp) => !!rp && rp.startsWith(fullP.replace(/\/$/, '') + '/'),
        locale: l,
        version: config.versions?.defaultVersion,
      })
    })
  }
  if (allVersions.length > 0 && locales.length > 0) {
    allVersions.forEach((v) => {
      locales.forEach((l) => {
        const fullP =
          baseDocsPath === '/' ? `/${v}/${l}` : `${baseDocsPath}/${v}/${l}`
        targetBasePaths.push({
          path: fullP,
          filter: (rp) => !!rp && rp.startsWith(fullP.replace(/\/$/, '') + '/'),
          locale: l,
          version: v,
        })
      })
    })
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
        Object.keys(config.i18n.locales).forEach((locale) => {
          externalPaths.add(
            `/${locale}${p === '/' ? '' : p}`.replace(/\/$/, ''),
          )
        })
      }
    })
  }

  targetBasePaths.forEach(
    ({ path: bPath, filter, locale: bLocale, version: bVersion }) => {
      if (bPath === '/') return

      const normalizedPath = bPath.replace(/\/$/, '')
      const hasExplicitMatch =
        docPathRegistry.has(normalizedPath) || externalPaths.has(normalizedPath)

      if (!hasExplicitMatch) {
        const defaultTab = config.theme?.tabs?.[0]?.id
        const defaultTabPath = defaultTab
          ? `${normalizedPath}/${defaultTab}`.replace(/\/+/g, '/')
          : null

        let matchedRouteObj: RouteRecord | undefined =
          defaultTabPath &&
          docPathRegistry.has(defaultTabPath.replace(/\/$/, ''))
            ? docRoutes.find(
                (r) =>
                  r.path &&
                  r.path.replace(/\/$/, '') ===
                    defaultTabPath.replace(/\/$/, ''),
              )
            : docRoutes.find(
                (r) => r.path && filter(r.path) && r.path !== normalizedPath,
              )

        if (!matchedRouteObj && docRoutes.length > 0) {
          matchedRouteObj = docRoutes[0]
        }

        if (matchedRouteObj) {
          const redirectPath =
            bPath === baseDocsPath
              ? '.'
              : bPath.startsWith(baseDocsPath + '/')
                ? bPath.slice(baseDocsPath.length + 1)
                : bPath

          const isBasePathFallback = redirectPath === '.'
          docRoutes.push({
            ...(isBasePathFallback
              ? { index: true as const }
              : { path: redirectPath }),
            element: matchedRouteObj.element,
            lazy: matchedRouteObj.lazy,
            loader: matchedRouteObj.loader,
            getStaticPaths: () => [],
          })

          const matchedMetaObj = docMetadata.find((m) => {
            const fullPath = withBase(m.path === '' ? '/' : m.path, config)
            const p =
              fullPath === baseDocsPath
                ? '.'
                : fullPath.startsWith(baseDocsPath + '/')
                  ? fullPath.slice(baseDocsPath.length + 1)
                  : fullPath
            return p === matchedRouteObj.path
          })

          if (matchedMetaObj) {
            const canonicalPath = withBase(matchedMetaObj.path, config)
            const canonicalUrl = config.siteUrl
              ? `${config.siteUrl.replace(/\/$/, '')}${canonicalPath}`
              : canonicalPath

            docMetadata.push({
              ...matchedMetaObj,
              path: bPath,
              filePath: matchedMetaObj.filePath,
              locale: bLocale,
              version: bVersion,
              slugParts: [],
              fallback: true,
              seo: {
                ...matchedMetaObj.seo,
                canonical: canonicalUrl,
              },
            })
          }
        }
      }
    },
  )

  return { routes: docRoutes, metadata: docMetadata }
}

export { buildDocRoutes }
