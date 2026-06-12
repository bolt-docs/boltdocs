import type { RouteRecord } from '@bdocs/ssg'
import type { ComponentRoute, BoltdocsConfig } from '../types'
import type React from 'react'
import { useLoaderData, Link } from 'react-router-dom'
import type { CollectionsData } from '../collections/collections-context'
import { buildModuleMap } from './create-routes.utils'
import { EagerMdxElement, resolveModuleLoader } from './mdx-elements'
import { DocsLayout } from '../app/docs-layout'

function DefaultCollectionList() {
  const data = useLoaderData() as {
    posts: any[]
    currentPage: number
    totalPages: number
    collection: string
  }
  if (!data || !data.posts) return null

  return (
    <div className="py-8 max-w-2xl mx-auto px-4">
      <h1 className="text-3xl font-bold mb-6 capitalize">{data.collection}</h1>
      <div className="space-y-6">
        {data.posts.map((post) => (
          <article key={post.path} className="border-b border-subtle pb-4">
            <h2 className="text-xl font-semibold mb-2">
              <Link to={post.path} className="text-primary-600 hover:underline">
                {post.title}
              </Link>
            </h2>
            {post.date && (
              <time className="text-xs text-muted block mb-2">
                {new Date(post.date).toLocaleDateString()}
              </time>
            )}
            {post.excerpt && (
              <p className="text-sm text-body">{post.excerpt}</p>
            )}
          </article>
        ))}
      </div>
      {data.totalPages > 1 && (
        <div className="mt-8 flex gap-4 text-sm">
          {data.currentPage > 1 && (
            <Link
              to={
                data.currentPage === 2
                  ? `/${data.collection}`
                  : `/${data.collection}/page/${data.currentPage - 1}`
              }
              className="text-primary-600 hover:underline"
            >
              Previous
            </Link>
          )}
          <span>
            Page {data.currentPage} of {data.totalPages}
          </span>
          {data.currentPage < data.totalPages && (
            <Link
              to={`/${data.collection}/page/${data.currentPage + 1}`}
              className="text-primary-600 hover:underline"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

function buildCollectionRoutes(options: {
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
  components?: Record<string, React.ComponentType>
  postsPerPage?: number
}): { children: RouteRecord[]; metadata: ComponentRoute[] } {
  const {
    routesData,
    collectionsData,
    collectionLayouts,
    collectionLists,
    collectionPosts,
    config,
    mdxModules,
    components,
  } = options
  const postsPerPage =
    options.postsPerPage ?? config.collections?.postsPerPage ?? 10

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

      const routeWithCollection: ComponentRoute = {
        ...route,
        collection: colName,
      }
      const postComponent = collectionPosts?.[colName]

      const routeRecord: RouteRecord = {
        path: subPath,
        loader: async () => ({
          route: routeWithCollection,
          headings: route.headings || [],
          collection: colName,
          path: subPath,
          frontmatter: {
            title: route.title,
            description: route.description || '',
            ...(route.frontmatter || {}),
          },
          filePath: route.filePath,
          locale: route.locale,
          version: route.version,
          date: route.date,
          lastUpdated: route.lastUpdated,
        }),
        getStaticPaths: () => [subPath || '.'],
      }

      if (isLazy && moduleLoader) {
        routeRecord.lazy = async () => {
          const mod = await resolveModuleLoader(moduleLoader)
          return {
            Component: function LoadedCollectionMdxRoute() {
              return (
                <EagerMdxElement
                  key={moduleKey || subPath}
                  moduleKey={moduleKey}
                  moduleLoader={mod}
                  route={route}
                  components={components}
                  collectionPostComponent={postComponent}
                />
              )
            },
          }
        }
      } else {
        routeRecord.element = (
          <EagerMdxElement
            key={moduleKey || subPath}
            moduleKey={moduleKey}
            moduleLoader={moduleLoader as any}
            route={route}
            components={components}
            collectionPostComponent={postComponent}
          />
        )
      }

      colChildren.push(routeRecord)

      metadata.push(route)
    }

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
      frontmatter: r.frontmatter,
    }))

    const listComponent = collectionLists?.[colName]
    const ListElement = listComponent || DefaultCollectionList

    colChildren.unshift({
      index: true,
      element: <ListElement />,
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
        element: <ListElement />,
        loader: async () => ({
          posts: paginatedPosts.slice((p - 1) * postsPerPage, p * postsPerPage),
          totalPages,
          currentPage: p,
          collection: colName,
        }),
        getStaticPaths: () => [`page/${p}`],
      })
    }

    const CustomLayout = collectionLayouts?.[colName]
    const CollectionLayout = CustomLayout || DocsLayout
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
