import type {
  RouteRecord,
  CreateRoutesResult,
  RouteRendererProps,
} from '../router'
import type { ComponentRoute, BoltdocsConfig } from '../types'
import { BoltdocsShell } from './boltdocs-shell'
import type React from 'react'
import type { CollectionsData } from '../collections/collections-context'
import { NotFoundWrapper } from './mdx-elements'
import { DocsLayout } from '../app/docs-layout'
import { buildDocRoutes } from './create-routes.doc'
import {
  buildExternalRoutes,
  buildExternalFileRoutes,
} from './create-routes.external'
import { buildCollectionRoutes } from './create-routes.collection'
import { ExternalPageWrapper } from './external-page-wrapper'
import {
  RouteRenderer,
  matchRouteBranch,
  matchRouteBranchWithParams,
  resolveRouteBranch,
} from '../router'

interface CreateRoutesOptions {
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

  externalPages?: Record<string, React.ComponentType>
  externalLayout?: React.ComponentType<{ children: React.ReactNode }>
  externalFilePages?: Record<string, React.ComponentType>
  externalFileMdx?: Record<string, unknown>
  components?: Record<string, React.ComponentType>
}

export function createRoutes(options: CreateRoutesOptions): CreateRoutesResult {
  const { config, components, externalLayout } = options

  const EffectiveExternalLayout =
    externalLayout || (({ children }) => <>{children}</>)

  const baseDocsPath = (config.base || '/docs').replace(/\/$/, '') || '/'

  const { routes: docRoutes, metadata: docMetadata } = buildDocRoutes(options)
  const externalRoutes = buildExternalRoutes(options)
  const externalFileRoutes = config.experimental?.fileRouting
    ? buildExternalFileRoutes(options)
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
  const collectionRoutes = buildCollectionRoutes(options)

  const children: RouteRecord[] = [
    { path: baseDocsPath, element: <DocsLayout />, children: docRoutes },
    ...externalRoutes.children,
    ...filteredExternalFileRoutes.children,
    ...collectionRoutes.children,
    {
      path: '*',
      element: (
        <ExternalPageWrapper>
          <EffectiveExternalLayout>
            <NotFoundWrapper />
          </EffectiveExternalLayout>
        </ExternalPageWrapper>
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
