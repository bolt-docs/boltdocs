import type { RouteRecord } from '@bdocs/ssg'
import type { ComponentRoute, BoltdocsConfig } from '../types'
import type React from 'react'
import { BlogLayout, BlogList } from '../collections'
import type { CollectionsData } from '../collections/collections-context'
import { buildModuleMap } from './create-routes.utils'
import { LazyMdxElement, EagerMdxElement } from './mdx-elements'

function buildCollectionRoutes(options: {
  routesData: ComponentRoute[]
  collectionsData?: CollectionsData
  collectionLayouts?: Record<
    string,
    React.ComponentType<{ children: React.ReactNode }>
  >
  config: BoltdocsConfig
  mdxModules: Record<string, any>
  components?: Record<string, React.ComponentType>
  postsPerPage?: number
}): { children: RouteRecord[]; metadata: ComponentRoute[] } {
  const { routesData, collectionsData, collectionLayouts, config, mdxModules, components } = options
  const postsPerPage = options.postsPerPage ?? config.collections?.postsPerPage ?? 10

  const children: RouteRecord[] = []
  const metadata: ComponentRoute[] = []

  const collectionsMap = new Map<string, ComponentRoute[]>()

  for (const r of routesData) {
    if (r.collection) {
      if (!collectionsMap.has(r.collection)) {
        collectionsMap.set(r.collection, [])
      }
      collectionsMap.get(r.collection)!.push(r)
    }
  }

  const moduleMap = buildModuleMap(mdxModules)
  const mdxModuleKeys = Object.keys(mdxModules)
  const isLazy =
    mdxModuleKeys.length > 0 &&
    typeof mdxModules[mdxModuleKeys[0]] === 'function'

  for (const [colName, colRoutes] of collectionsMap) {
    const colBase = `/${colName}`
    colRoutes.sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0
      const db = b.date ? new Date(b.date).getTime() : 0
      return db - da
    })

    const colChildren: RouteRecord[] = []

    for (const route of colRoutes) {
      const normalizedFilePath = route.filePath.replace(/\\/g, '/')
      const moduleKey = moduleMap.get(normalizedFilePath)
      const moduleLoader = moduleKey ? mdxModules[moduleKey] : null
      const subPath = route.path.startsWith(colBase + '/')
        ? route.path.slice(colBase.length + 1)
        : route.path.replace(colBase, '') || ''

      const routeWithCollection: ComponentRoute = { ...route, collection: colName }

      colChildren.push({
        path: subPath,
        element: isLazy ? (
          <LazyMdxElement
            key={moduleKey || subPath}
            getModule={moduleLoader}
            moduleKey={moduleKey}
            route={route}
            components={components}
          />
        ) : (
          <EagerMdxElement
            key={moduleKey || subPath}
            moduleKey={moduleKey}
            moduleLoader={moduleLoader}
            route={route}
            components={components}
          />
        ),
        // Clean loader: pass the full route object instead of duplicating fields.
        // BlogPost reads from data.route directly via CollectionPostLoaderData.
        loader: async () => ({
          route: routeWithCollection,
          headings: route.headings || [],
          collection: colName,
        }),
        getStaticPaths: () => [subPath || '.'],
      })

      metadata.push(route)
    }

    // Build the list data shape (CollectionListLoaderData)
    const totalPages = Math.ceil(colRoutes.length / postsPerPage)
    const paginatedPosts = colRoutes.map((r) => ({
      path: r.path,
      title: r.title,
      date: r.date,
      excerpt: r.excerpt,
      tags: r.tags,
      author: r.author,
      coverImage: r.coverImage,
      filePath: r.filePath,
    }))

    colChildren.unshift({
      index: true,
      element: <BlogList />,
      loader: async () => ({
        posts: paginatedPosts.slice(0, postsPerPage),
        totalPages,
        currentPage: 1,
        collection: colName,
      }),
      getStaticPaths: () => [],
    })

    for (let p = 2; p <= totalPages; p++) {
      colChildren.push({
        path: `page/${p}`,
        element: <BlogList />,
        loader: async () => ({
          posts: paginatedPosts.slice(
            (p - 1) * postsPerPage,
            p * postsPerPage,
          ),
          totalPages,
          currentPage: p,
          collection: colName,
        }),
        getStaticPaths: () => [`page/${p}`],
      })
    }

    const CustomLayout = collectionLayouts?.[colName]
    const CollectionLayout = CustomLayout || BlogLayout
    const blogLayoutRoute: RouteRecord = {
      path: colBase,
      element: <CollectionLayout collectionsData={collectionsData || {}} />,
      children: colChildren,
    }

    children.push(blogLayoutRoute)
  }

  return { children, metadata }
}

export { buildCollectionRoutes }
