import type { RouteRecord } from '@bdocs/ssg'
import type { ComponentRoute, BoltdocsConfig } from '../types'
import { MdxPage } from './mdx-page'
import { BoltdocsShell } from './boltdocs-shell'
import { NotFound, Loading } from '../components/ui-base'
import type React from 'react'
import { Suspense, useState, useEffect } from 'react'

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
 * Finds the matching module key from import.meta.glob for a given filePath.
 */
function findModuleKey(
  modules: Record<string, any>,
  filePath: string,
): string | undefined {
  const normalizedFilePath = filePath.replace(/\\/g, '/')
  const keys = Object.keys(modules)
  if (keys.length === 0) return undefined

  // Detect docs directory from keys (e.g., "/docs/...")
  const firstKey = keys[0].replace(/\\/g, '/')
  const parts = firstKey.split('/').filter(Boolean)
  const docsDirName = parts[0] || 'docs'

  const targetKey = `/${docsDirName}/${normalizedFilePath}`
  const targetKeyAlt = `./${docsDirName}/${normalizedFilePath}`

  return keys.find((key) => {
    const k = key.replace(/\\/g, '/')
    return k === targetKey || k === targetKeyAlt || k.endsWith(targetKey)
  })
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
  const isLazy = typeof moduleLoader === 'function'

  // For eager mode, resolve component synchronously.
  const eagerComponent = !isLazy
    ? (moduleLoader?.default ?? moduleLoader ?? null)
    : null

  const [MDXComponent, setMDXComponent] = useState<React.ComponentType | null>(
    () => eagerComponent,
  )

  // On first mount, load the module if in lazy mode.
  useEffect(() => {
    if (!isLazy || !moduleLoader) return
    let cancelled = false
    moduleLoader().then((m: any) => {
      if (!cancelled) setMDXComponent(() => m.default || m)
    })
    return () => {
      cancelled = true
    }
  }, [isLazy, moduleLoader])

  // Listen for Boltdocs MDX HMR events.
  useEffect(() => {
    if (!import.meta.hot || !moduleKey) return

    const handler = (data: { relPath: string }) => {
      const incoming = data.relPath.replace(/\\/g, '/').replace(/^\//, '')
      const routeFile = route.filePath.replace(/\\/g, '/').replace(/^\//, '')

      if (incoming !== routeFile) return

      // Use a cache-busting URL to fetch the freshly compiled version.
      const cacheBustUrl = moduleKey + '?t=' + Date.now()
      import(/* @vite-ignore */ cacheBustUrl).then((m: any) => {
        setMDXComponent(() => m.default || m)
      })
    }

    import.meta.hot.on('boltdocs:mdx-update', handler)
    return () => import.meta.hot?.off('boltdocs:mdx-update', handler)
  }, [moduleKey, route.filePath])

  if (!MDXComponent) return <Loading />

  return (
    <Suspense fallback={<Loading />}>
      <MdxPage MDXComponent={MDXComponent} mdxComponents={components} />
    </Suspense>
  )
}

import { DocsLayout } from '../app/docs-layout'

export function createRoutes(options: CreateRoutesOptions): RouteRecord[] {
  const {
    routesData,
    config,
    mdxModules,
    Layout,

    externalPages,
    externalLayout,
    components,
  } = options

  const EffectiveExternalLayout = externalLayout || Layout

  const withBase = (path: string) => {
    // Future support for base path in config
    const base = config.base || '/'
    if (path.startsWith(base)) return path
    const b = base === '/' ? '' : base.replace(/\/$/, '')
    const p = path.startsWith('/') ? path : `/${path}`
    return `${b}${p}` || '/'
  }

  const allMetadata: ComponentRoute[] = [...routesData]

  // 1. Documentation routes
  const docRoutes: RouteRecord[] = routesData.map((route) => {
    const moduleKey = findModuleKey(mdxModules, route.filePath)
    const moduleLoader = moduleKey ? mdxModules[moduleKey] : null
    const path = withBase(route.path === '' ? '/' : route.path)

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

  // Group all documentation routes under the persistent DocsLayout
  const docsLayoutRoute: RouteRecord = {
    element: <DocsLayout />,
    children: docRoutes,
  }

  const children: RouteRecord[] = [docsLayoutRoute]

  // 3. External pages
  if (externalPages) {
    Object.entries(externalPages).forEach(([rawPath, ExtComponent]) => {
      // Use the path exactly as defined in externalPages
      const path = rawPath
      if (!children.find((r) => r.path === path)) {
        allMetadata.push({
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

        // Also add i18n variants for external pages if needed
        if (config.i18n) {
          Object.keys(config.i18n.locales).forEach((locale) => {
            const localePath = `/${locale}${rawPath === '/' ? '' : rawPath}`
            if (!children.find((r) => r.path === localePath)) {
              allMetadata.push({
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
        <NotFound />
      </EffectiveExternalLayout>
    ),
  })

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
