import type { RouteRecord } from '@bdocs/ssg'
import type { ComponentRoute, BoltdocsConfig } from '../types'
import { MdxPage } from './mdx-page'
import { BoltdocsShell } from './boltdocs-shell'
import { NotFound } from '../components/ui-base'
const Loading = () => <div className="text-muted text-sm py-4">Loading...</div>
import type React from 'react'
import { useEffect } from 'react'

interface CreateRoutesOptions {
  routesData: ComponentRoute[]
  config: BoltdocsConfig
  mdxModules: Record<string, any>
  Layout: React.ComponentType<{ children: React.ReactNode }>

  externalPages?: Record<string, React.ComponentType>
  externalLayout?: React.ComponentType<{ children: React.ReactNode }>
  components?: Record<string, React.ComponentType>
}

/**
 * Stable component to render MDX pages.
 * By being outside createRoutes, it prevents React from unmounting the page on HMR.
 */
const MdxRouteElement = ({
  moduleLoader,
  moduleKey,
  route,
  components,
}: {
  moduleLoader: any
  moduleKey: string | undefined
  route: ComponentRoute
  components: any
}) => {
  const MDXComponent = moduleLoader?.default ?? moduleLoader ?? null

  useEffect(() => {
    if (!import.meta.hot || !moduleKey) return

    const handler = (data: { relPath: string }) => {
      const incoming = data.relPath.replace(/\\/g, '/').replace(/^\//, '')
      const routeFile = route.filePath.replace(/\\/g, '/').replace(/^\//, '')

      if (incoming !== routeFile) return

      const cacheBustUrl = moduleKey + '?t=' + Date.now()
      import(/* @vite-ignore */ cacheBustUrl).then((m: any) => {
        MDXComponent
      })
    }

    import.meta.hot.on('boltdocs:mdx-update', handler)
    return () => import.meta.hot?.off('boltdocs:mdx-update', handler)
  }, [moduleKey, route.filePath])

  if (!MDXComponent) return <Loading />

  return <MdxPage MDXComponent={MDXComponent} mdxComponents={components} />
}

import { useMdxComponents } from '../app/mdx-components-context'

const NotFoundWrapper = () => {
  const components = useMdxComponents()
  const ActiveNotFound = components.NotFound || components['404'] || NotFound
  return <ActiveNotFound />
}

import { DocsLayout } from '../app/docs-layout'

export function createRoutes(options: CreateRoutesOptions): RouteRecord[] {
  const {
    routesData,
    config,
    mdxModules,
    externalPages,
    externalLayout,
    components,
  } = options

  const EffectiveExternalLayout =
    externalLayout || (({ children }: any) => <>{children}</>)

  const withBase = (path: string) => {
    // Future support for base path in config
    const base = config.base || '/'
    if (path.startsWith(base)) return path
    const b = base === '/' ? '' : base.replace(/\/$/, '')
    const p = path.startsWith('/') ? path : `/${path}`
    return `${b}${p}` || '/'
  }

  const defaultVersionMetadata: ComponentRoute[] = []

  // Inject virtual explicit routes for default version to ensure paths like /docs/latest/... aren't 404s
  const defaultVersion = config.versions?.defaultVersion
  const docsBase = (config.base || '/docs').replace(/\/$/, '')

  // Base path under which all doc routes are nested (e.g., "/docs")
  // Used to compute relative child paths for correct React Router nesting
  let baseDocsPath = (config.base || '/docs').replace(/\/$/, '')
  if (!baseDocsPath) baseDocsPath = '/'

  if (defaultVersion) {
    routesData.forEach((route) => {
      // If this route explicitly already belongs to a version, do not clone.
      if (route.version) return

      // Compute path without docs base prefix to properly place version token
      const p = route.path || ''
      const subPath = p.startsWith(docsBase)
        ? p.substring(docsBase.length).replace(/^\//, '')
        : p.replace(/^\//, '')

      // Detect if it already includes the target version segment
      const hasVersionPrefix =
        subPath === defaultVersion || subPath.startsWith(`${defaultVersion}/`)

      if (!hasVersionPrefix) {
        // Standardize reconstruction: [docsBase] / [version] / [remaining_path]
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

  const docMetadata = [...routesData, ...defaultVersionMetadata]

  // 0. Build a single pre-computed lookup map for the MDX modules (O(N) build, O(1) access).
  // This replaces the inner findModuleKey loops that executed an O(N) scan for EVERY route.
  const moduleMap = new Map<string, string>()
  const mdxModuleKeys = Object.keys(mdxModules)

  if (mdxModuleKeys.length > 0) {
    // Detect docs directory structure from keys (e.g., "/docs/intro.md")
    const firstKeyNormalized = mdxModuleKeys[0].replace(/\\/g, '/')
    const parts = firstKeyNormalized.split('/').filter(Boolean)
    const docsDirName = parts[0] || 'docs'
    const primaryPrefix = `/${docsDirName}/`
    const altPrefix = `./${docsDirName}/`

    for (const rawKey of mdxModuleKeys) {
      const k = rawKey.replace(/\\/g, '/')
      let relativePath = ''
      if (k.indexOf(primaryPrefix) !== -1) {
        relativePath = k.substring(
          k.indexOf(primaryPrefix) + primaryPrefix.length,
        )
      } else if (k.startsWith(altPrefix)) {
        relativePath = k.substring(altPrefix.length)
      }

      if (relativePath) {
        moduleMap.set(relativePath, rawKey)
      } else {
        // Fallback: store full normalized key as a catch-all
        moduleMap.set(k, rawKey)
      }
    }
  }

  // 1. Documentation routes
  const docRoutes: RouteRecord[] = docMetadata.map((route) => {
    // Perform constant-time lookup using the pre-computed map
    const normalizedFilePath = route.filePath.replace(/\\/g, '/')
    const moduleKey = moduleMap.get(normalizedFilePath)
    const moduleLoader = moduleKey ? mdxModules[moduleKey] : null
    const fullPath = withBase(route.path === '' ? '/' : route.path)
    const path =
      fullPath === baseDocsPath
        ? '.'
        : fullPath.startsWith(baseDocsPath + '/')
          ? fullPath.slice(baseDocsPath.length + 1)
          : fullPath

    return {
      path,
      element: (
        <MdxRouteElement
          key={moduleKey || path}
          moduleKey={moduleKey}
          moduleLoader={moduleLoader}
          route={route}
          components={components}
        />
      ),
      loader: async () => ({
        path,
        frontmatter: {
          title: route.title,
          description: route.description || '',
          ...(route.frontmatter || {}),
        },
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
  })

  // 2. Auto-fallback for the base paths (e.g. /docs, /docs/es) to the first documentation page

  const locales = config.i18n?.locales
    ? Array.isArray(config.i18n.locales)
      ? config.i18n.locales
      : Object.keys(config.i18n.locales)
    : []

  // 2a. Generate dynamic permutation matrix of version/locale combinations
  const allVersions = config.versions?.versions?.map((v) => v.path) || []

  const targetBasePaths: Array<{
    path: string
    filter: (p: string) => boolean
  }> = []

  // Insert base root always
  targetBasePaths.push({
    path: baseDocsPath,
    filter: () => true, // Take first available doc generally
  })

  // Permutation builder: version loop nested with locale loop
  // Ensures paths like /docs/v2.0, /docs/es, and /docs/v2.0/es ALL receive fallback logic.
  const subPaths: string[] = []
  if (allVersions.length > 0) {
    allVersions.forEach((v) => subPaths.push(`/${v}`))
  }
  if (locales.length > 0) {
    locales.forEach((l) => subPaths.push(`/${l}`))
  }
  if (allVersions.length > 0 && locales.length > 0) {
    allVersions.forEach((v) => {
      locales.forEach((l) => {
        subPaths.push(`/${v}/${l}`)
      })
    })
  }

  // Map permutations onto the physical base docs route
  subPaths.forEach((sp) => {
    const fullP = baseDocsPath === '/' ? sp : `${baseDocsPath}${sp}`
    targetBasePaths.push({
      path: fullP,
      filter: (rp) => rp.startsWith(fullP.replace(/\/$/, '') + '/'),
    })
  })

  // Pre-compute a Set of absolute and normalized path strings from the real routes
  // to perform O(1) validation checks within the redirection loops below.
  const docPathRegistry = new Set(
    docRoutes.map((r) => (r.path || '').replace(/\/$/, '')),
  )

  // Pre-compute external pages paths so we do not hijack them with redirects
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

  // 2b. Deploy smart redirects
  targetBasePaths.forEach(({ path: bPath, filter }) => {
    if (bPath === '/') return // Never hijack global app root

    const normalizedPath = bPath.replace(/\/$/, '')
    const hasExplicitMatch =
      docPathRegistry.has(normalizedPath) || externalPaths.has(normalizedPath)

    if (!hasExplicitMatch) {
      const defaultTab = config.theme?.tabs?.[0]?.id
      const defaultTabPath = defaultTab
        ? `${normalizedPath}/${defaultTab}`.replace(/\/+/g, '/')
        : null

      // Prioritize: Find a real route that matches the default tab first, then fall back to the first route beginning with this pattern.
      let matchedRouteObj: RouteRecord | undefined =
        defaultTabPath && docPathRegistry.has(defaultTabPath.replace(/\/$/, ''))
          ? docRoutes.find(
              (r) =>
                r.path.replace(/\/$/, '') === defaultTabPath.replace(/\/$/, ''),
            )
          : docRoutes.find((r) => filter(r.path) && r.path !== normalizedPath)

      // Ultimate fallback: the absolute first document
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
        docRoutes.push({
          path: redirectPath,
          element: matchedRouteObj.element,
          loader: matchedRouteObj.loader,
          getStaticPaths: () => [],
        })

        const matchedMetaObj = docMetadata.find((m) => {
          const fullPath = withBase(m.path === '' ? '/' : m.path)
          const p =
            fullPath === baseDocsPath
              ? '.'
              : fullPath.startsWith(baseDocsPath + '/')
                ? fullPath.slice(baseDocsPath.length + 1)
                : fullPath
          return p === matchedRouteObj.path
        })

        if (matchedMetaObj) {
          const canonicalPath = withBase(matchedMetaObj.path)
          const canonicalUrl = config.siteUrl
            ? `${config.siteUrl.replace(/\/$/, '')}${canonicalPath}`
            : canonicalPath

          docMetadata.push({
            ...matchedMetaObj,
            path: bPath,
            seo: {
              ...matchedMetaObj.seo,
              canonical: canonicalUrl,
            },
          })
        }
      }
    }
  })

  // Group all documentation routes under the persistent DocsLayout
  const docsLayoutRoute: RouteRecord = {
    path: baseDocsPath,
    element: <DocsLayout />,
    children: docRoutes,
  }

  const children: RouteRecord[] = [docsLayoutRoute]

  // 3. External pages
  const externalMetadata: ComponentRoute[] = []
  if (externalPages) {
    Object.entries(externalPages).forEach(([rawPath, ExtComponent]) => {
      // Use the raw path directly (do not prefix with base docs path)
      const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`
      if (!children.find((r) => r.path === path)) {
        externalMetadata.push({
          path,
          locale: config.i18n?.defaultLocale,
          title:
            rawPath === '/'
              ? 'Home'
              : rawPath.replace(/^\//, '').split('/').pop() || 'Page',
          filePath: '',
          headings: [],
        } as any)

        children.push({
          path,
          element: (
            <EffectiveExternalLayout>
              <ExtComponent />
            </EffectiveExternalLayout>
          ),
          loader: async () => ({
            path,
            locale: config.i18n?.defaultLocale,
          }),
          getStaticPaths: () => [path],
        })

        // Also add i18n variants for external pages if needed (do not prefix with base docs path)
        if (config.i18n) {
          Object.keys(config.i18n.locales).forEach((locale) => {
            const localePath = `/${locale}${rawPath === '/' ? '' : rawPath}`
            if (!children.find((r) => r.path === localePath)) {
              externalMetadata.push({
                path: localePath,
                locale,
                title: rawPath,
                filePath: '',
                headings: [],
              } as any)

              children.push({
                path: localePath,
                element: (
                  <EffectiveExternalLayout>
                    <ExtComponent />
                  </EffectiveExternalLayout>
                ),
                loader: async () => ({
                  path: localePath,
                  locale,
                }),
                getStaticPaths: () => [localePath],
              })
            }
          })
        }
      }
    })
  }

  // --- 4. 404 catch-all ---
  children.push({
    path: '*',
    element: (
      <EffectiveExternalLayout>
        <NotFoundWrapper />
      </EffectiveExternalLayout>
    ),
  })

  const allMetadata = [...docMetadata, ...externalMetadata]

  // Wrap everything in the Boltdocs shell (providers)
  return [
    {
      // No path = Layout Route
      // This allows children to retain their absolute paths while being wrapped in the shell.
      element: (
        <BoltdocsShell
          config={config}
          routes={allMetadata}
          components={components}
        />
      ),
      children,
    },
  ]
}
