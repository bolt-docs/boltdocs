import type { RouteRecord } from '../router'
import type { ComponentRoute, BoltdocsConfig } from '../types'
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
  const paths = new Set([
    ...Object.keys(externalFilePages || {}),
    ...Object.keys(externalFileMdx || {}),
  ])

  for (const pathname of paths) {
    for (const localized of getLocalizedPaths(pathname, config)) {
      const mdxLoader = externalFileMdx?.[pathname]
      const component = externalFilePages?.[pathname]
      metadata.push(
        buildExternalRouteMetadata(
          localized.path,
          localized.locale,
          routeTitle(pathname),
        ),
      )
      children.push(
        buildExternalRouteRecord({
          path: localized.path,
          locale: localized.locale,
          component,
          mdxLoader,
          externalLayout: EffectiveExternalLayout,
          components,
          title: routeTitle(pathname),
        }),
      )
    }
  }

  return { children, metadata }
}

export { buildExternalRoutes, buildExternalFileRoutes }
