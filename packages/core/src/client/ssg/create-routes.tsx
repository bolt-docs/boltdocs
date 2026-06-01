import type { RouteRecord } from '@bdocs/ssg'
import type { ComponentRoute, BoltdocsConfig } from '../types'
import { BoltdocsShell } from './boltdocs-shell'
import type React from 'react'
import type { CollectionsData } from '../collections/collections-context'
import { NotFoundWrapper } from './mdx-elements'
import { DocsLayout } from '../app/docs-layout'
import { buildDocRoutes } from './create-routes.doc'
import { buildExternalRoutes } from './create-routes.external'
import { buildCollectionRoutes } from './create-routes.collection'

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
  components?: Record<string, React.ComponentType>
}

export function createRoutes(options: CreateRoutesOptions): RouteRecord[] {
  const { config, components, externalLayout } = options

  const EffectiveExternalLayout =
    externalLayout || (({ children }) => <>{children}</>)

  const baseDocsPath = (config.base || '/docs').replace(/\/$/, '') || '/'

  const { routes: docRoutes, metadata: docMetadata } = buildDocRoutes(options)

  const externalRoutes = buildExternalRoutes(options)

  const collectionRoutes = buildCollectionRoutes(options)

  const children: RouteRecord[] = [
    { path: baseDocsPath, element: <DocsLayout />, children: docRoutes },
    ...externalRoutes.children,
    ...collectionRoutes.children,
    {
      path: '*',
      element: (
        <EffectiveExternalLayout>
          <NotFoundWrapper />
        </EffectiveExternalLayout>
      ),
    },
  ]

  const allMetadata = [
    ...docMetadata,
    ...externalRoutes.metadata,
    ...collectionRoutes.metadata,
  ]

  return [
    {
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
