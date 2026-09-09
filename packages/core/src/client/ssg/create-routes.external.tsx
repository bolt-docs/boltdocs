import type { RouteRecord } from '../router'
import type { ComponentRoute, BoltdocsConfig } from '../types'
import { cn } from '../utils/cn'
import { ExternalPageWrapper } from './external-page-wrapper'
import {
  EagerMdxElement,
  resolveModuleLoader,
  type MdxModule,
} from './mdx-elements'

interface ExternalRouteOptions {
  externalPages?: Record<string, React.ComponentType>
  externalLayout?: React.ComponentType<{ children: React.ReactNode }>
  externalFilePages?: Record<string, React.ComponentType>
  externalFileMdx?: Record<string, unknown>
  components?: Record<string, React.ComponentType>
  config: BoltdocsConfig
}

function getLocales(config: BoltdocsConfig): string[] {
  if (!config.i18n) return []
  return Array.isArray(config.i18n.locales)
    ? config.i18n.locales
    : Object.keys(config.i18n.locales)
}

function getLocalizedPaths(
  pathname: string,
  config: BoltdocsConfig,
): Array<{ path: string; locale?: string }> {
  const paths = [{ path: pathname, locale: config.i18n?.defaultLocale }]
  for (const locale of getLocales(config)) {
    const localizedPath =
      pathname === '/' ? `/${locale}` : `/${locale}${pathname}`
    if (!paths.some((entry) => entry.path === localizedPath)) {
      paths.push({ path: localizedPath, locale })
    }
  }
  return paths
}

/**
 * Content wrapper for file-routed MDX pages. The external layout renders the
 * site chrome (navbar/footer), but unlike docs pages these routes are not
 * nested inside DocsLayout, so the MDX content needs its own page container
 * with the page title and prose typography — otherwise it renders raw and
 * edge-to-edge directly below the navbar.
 */
function ExternalMdxContent({
  title,
  children,
  className,
  contentClassName,
}: {
  title?: string
  children: React.ReactNode
  className?: string
  contentClassName?: string
}) {
  return (
    <div
      className={cn('boltdocs-page w-full pt-4 pb-20 px-4 sm:px-8', className)}
    >
      <div
        className={cn(
          'mx-auto w-full max-w-3xl sm:max-w-4xl lg:max-w-5xl',
          contentClassName,
        )}
      >
        {title && (
          <h1 className="text-4xl font-bold tracking-tight text-body mb-3">
            {title}
          </h1>
        )}
        <div className="prose prose-neutral dark:prose-invert max-w-none">
          {children}
        </div>
      </div>
    </div>
  )
}

function routeTitle(pathname: string): string {
  const segment =
    pathname === '/' ? 'Home' : pathname.split('/').filter(Boolean).at(-1)
  return segment
    ? segment
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    : 'Page'
}

function buildExternalRouteRecord(options: {
  path: string
  locale?: string
  component?: React.ComponentType
  mdxLoader?: unknown
  externalLayout: React.ComponentType<{ children: React.ReactNode }>
  components?: Record<string, React.ComponentType>
  title: string
}): RouteRecord {
  const {
    path,
    locale,
    component,
    mdxLoader,
    externalLayout,
    components,
    title,
  } = options
  const record: RouteRecord = {
    path,
    locale,
    loader: async () => ({ path, locale }),
    getStaticPaths: () => [path],
  }
  const ExternalLayout = externalLayout
  const ExternalComponent = component

  if (ExternalComponent) {
    record.element = (
      <ExternalPageWrapper>
        <ExternalLayout>
          <ExternalComponent />
        </ExternalLayout>
      </ExternalPageWrapper>
    )
  } else if (mdxLoader) {
    record.lazy = async () => {
      const module = (await resolveModuleLoader(
        mdxLoader as MdxModule,
      )) as MdxModule
      return {
        Component: function ExternalMdxRoute() {
          return (
            <ExternalPageWrapper>
              <ExternalLayout>
                <ExternalMdxContent title={title}>
                  <EagerMdxElement
                    moduleLoader={module}
                    moduleKey={path}
                    route={{
                      path,
                      title,
                      filePath: path,
                      componentPath: '',
                      headings: [],
                      locale,
                    }}
                    components={
                      (components || {}) as Record<string, React.ComponentType>
                    }
                  />
                </ExternalMdxContent>
              </ExternalLayout>
            </ExternalPageWrapper>
          )
        },
      }
    }
  }

  return record
}

function buildExternalRouteMetadata(
  path: string,
  locale: string | undefined,
  title: string,
): ComponentRoute {
  return {
    path,
    locale,
    title,
    filePath: '',
    componentPath: '',
    headings: [],
  }
}

function buildExternalRoutes(options: ExternalRouteOptions): {
  children: RouteRecord[]
  metadata: ComponentRoute[]
} {
  const { externalPages, externalLayout, config } = options
  const children: RouteRecord[] = []
  const metadata: ComponentRoute[] = []

  if (!externalPages) return { children, metadata }

  const EffectiveExternalLayout =
    externalLayout ||
    (({ children }: { children: React.ReactNode }) => <>{children}</>)

  Object.entries(externalPages).forEach(([rawPath, ExtComponent]) => {
    const pathname = rawPath.startsWith('/') ? rawPath : `/${rawPath}`
    for (const localized of getLocalizedPaths(pathname, config)) {
      metadata.push(
        buildExternalRouteMetadata(
          localized.path,
          localized.locale,
          routeTitle(pathname),
        ),
      )
      children.push({
        ...buildExternalRouteRecord({
          path: localized.path,
          locale: localized.locale,
          component: ExtComponent,
          externalLayout: EffectiveExternalLayout,
          title: routeTitle(pathname),
        }),
      })
    }
  })

  return { children, metadata }
}

function buildExternalFileRoutes(options: ExternalRouteOptions): {
  children: RouteRecord[]
  metadata: ComponentRoute[]
} {
  const {
    externalFilePages,
    externalFileMdx,
    externalLayout,
    components,
    config,
  } = options
  const children: RouteRecord[] = []
  const metadata: ComponentRoute[] = []
  if (!externalFilePages && !externalFileMdx) return { children, metadata }

  const EffectiveExternalLayout =
    externalLayout ||
    (({ children }: { children: React.ReactNode }) => <>{children}</>)
  const locales = getLocales(config)
  const isLocalizedPath = (pathname: string): boolean =>
    locales.some(
      (locale) =>
        pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
    )
  const localeOfPath = (pathname: string): string | undefined => {
    const first = pathname.split('/').filter(Boolean)[0]
    return first && locales.includes(first) ? first : undefined
  }

  const fileRoutes = new Set([
    ...Object.keys(externalFilePages || {}),
    ...Object.keys(externalFileMdx || {}),
  ])
  const registeredPaths = new Set<string>()

  const pushRoute = (
    pathname: string,
    locale: string | undefined,
    mdxLoader: unknown,
    component: React.ComponentType | undefined,
  ) => {
    if (registeredPaths.has(pathname)) return
    registeredPaths.add(pathname)
    metadata.push(
      buildExternalRouteMetadata(pathname, locale, routeTitle(pathname)),
    )
    children.push(
      buildExternalRouteRecord({
        path: pathname,
        locale,
        component,
        mdxLoader,
        externalLayout: EffectiveExternalLayout,
        components,
        title: routeTitle(pathname),
      }),
    )
  }

  // Real files first: every file — default or localized — owns its exact
  // path (`roadmap.mdx` → `/roadmap`, `es/roadmap.mdx` → `/es/roadmap`).
  for (const pathname of fileRoutes) {
    pushRoute(
      pathname,
      localeOfPath(pathname) || config.i18n?.defaultLocale,
      externalFileMdx?.[pathname],
      externalFilePages?.[pathname],
    )
  }

  // Fallback variants: default-locale files also serve every configured
  // locale URL when no localized file exists (same semantics as the docs
  // i18n fallback routes). Localized files registered above win.
  for (const pathname of fileRoutes) {
    if (isLocalizedPath(pathname)) continue
    const mdxLoader = externalFileMdx?.[pathname]
    const component = externalFilePages?.[pathname]
    for (const localized of getLocalizedPaths(pathname, config)) {
      pushRoute(localized.path, localized.locale, mdxLoader, component)
    }
  }

  return { children, metadata }
}

export { buildExternalRoutes, buildExternalFileRoutes }
