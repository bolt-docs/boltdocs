import type { ReactNode } from 'react'
import type {
  CreateRoutesResult,
  RouteRecord,
  RouteRendererProps,
} from '../router'
import {
  RouteRenderer,
  matchRouteBranch,
  matchRouteBranchWithParams,
  resolveRouteBranch,
} from '../router'
import type { BoltdocsConfig, ComponentRoute } from '../types'
import type { CollectionsData } from '../collections/collections-context'
import { BoltdocsShell } from './shell'
import { NotFoundWrapper } from './mdx-elements'
import { buildDocRoutes } from './create-routes.doc'
import {
  buildExternalRoutes,
  buildExternalFileRoutes,
} from './create-routes.external'
import { buildCollectionRoutes } from './create-routes.collection'
import { buildRedirectRoutes } from './create-routes.redirect'
import type { BoltdocsTheme } from './theme'

export interface CreateRoutesOptions {
  routesData: ComponentRoute[]
  collectionsData?: CollectionsData
  collectionLayouts?: Record<
    string,
    React.ComponentType<{ children: React.ReactNode }>
  >
  collectionLists?: Record<string, React.ComponentType>
  collectionPosts?: Record<string, React.ComponentType<any>>
  config: BoltdocsConfig
  mdxModules: Record<string, any>

  externalPages?: Record<
    string,
    React.ComponentType | (() => Promise<{ default: React.ComponentType }>)
  >
  externalLayout?: React.ComponentType<{ children: React.ReactNode }>
  externalFilePages?: Record<
    string,
    React.ComponentType | (() => Promise<{ default: React.ComponentType }>)
  >
  externalFileMdx?: Record<string, unknown>
  components?: Record<string, React.ComponentType>
}

/** The documentation routes' element: the theme's chrome around the page. */
function DocsRoute({ theme }: { theme: BoltdocsTheme }) {
  const Layout = theme.DocsLayout
  return <Layout />
}

/**
 * Builds the route table the application renders.
 *
 * The theme arrives as an argument, not as an import: the engine builds the
 * routes and the theme decides what each one looks like. That is what makes a
 * second theme a package rather than a copy of this file.
 */
export function createRoutes(
  options: CreateRoutesOptions,
  theme: BoltdocsTheme,
): CreateRoutesResult {
  const { config, components, externalLayout } = options

  const EffectiveExternalLayout =
    externalLayout ||
    (({ children }: { children?: ReactNode }) => <>{children}</>)

  const baseDocsPath = (config.base || '/docs').replace(/\/$/, '') || '/'

  const { routes: docRoutes, metadata: docMetadata } = buildDocRoutes(
    options,
    theme,
  )
  const externalRoutes = buildExternalRoutes(options, theme)
  const externalFileRoutes = config.experimental?.fileRouting
    ? buildExternalFileRoutes(options, theme)
    : { children: [], metadata: [] }
  const occupiedPaths = new Set([
    ...docMetadata.map((route) => route.path),
    ...externalRoutes.metadata.map((route) => route.path),
  ])
  const acceptedExternalFilePaths = new Set<string>()
  const filteredExternalFileRoutes = {
    children: externalFileRoutes.children,
    metadata: externalFileRoutes.metadata.filter((route) => {
      if (occupiedPaths.has(route.path)) return false
      occupiedPaths.add(route.path)
      acceptedExternalFilePaths.add(route.path)
      return true
    }),
  }
  filteredExternalFileRoutes.children = externalFileRoutes.children.filter(
    (route) => !route.path || acceptedExternalFilePaths.has(route.path),
  )
  const collectionRoutes = buildCollectionRoutes(options, theme)
  const redirectRoutes = buildRedirectRoutes({ config })

  const children: RouteRecord[] = [
    {
      path: baseDocsPath,
      element: <DocsRoute theme={theme} />,
      children: docRoutes,
    },
    ...externalRoutes.children,
    ...filteredExternalFileRoutes.children,
    ...collectionRoutes.children,
    ...redirectRoutes,
    {
      path: '*',
      element: (
        <theme.ExternalPage>
          <EffectiveExternalLayout>
            <NotFoundWrapper notFound={theme.NotFound} />
          </EffectiveExternalLayout>
        </theme.ExternalPage>
      ),
    },
  ]

  const allMetadata = [
    ...docMetadata,
    ...externalRoutes.metadata,
    ...filteredExternalFileRoutes.metadata,
    ...collectionRoutes.metadata,
  ]

  const routes: RouteRecord[] = [
    {
      element: (
        <BoltdocsShell
          theme={theme}
          config={config}
          routes={allMetadata}
          components={components}
          collectionsData={options.collectionsData}
        />
      ),
      children,
    },
  ]

  const BaseAwareRouteRenderer: React.FC<RouteRendererProps> = (props) => (
    <RouteRenderer
      {...props}
      basename={config.base}
      defaultLocale={config.i18n?.defaultLocale}
      viewTransitions={
        config.experimental?.viewTransitions === true
          ? true
          : typeof config.experimental?.viewTransitions === 'object'
            ? config.experimental.viewTransitions
            : undefined
      }
    />
  )

  return {
    routes,
    RouteRenderer:
      BaseAwareRouteRenderer as React.ComponentType<RouteRendererProps>,
    matchRouteBranch,
    matchRouteBranchWithParams,
    resolveRouteBranch,
  }
}
