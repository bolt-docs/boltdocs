import type { RouteRecord } from '../router'
import type { ComponentRoute, BoltdocsConfig } from '../types'
import type React from 'react'
import { buildUrl, useLocation, useLoaderData } from '../router'
import { Link } from '../components/primitives/link'
import type { CollectionsData } from '../collections/collections-context'
import { usePosts } from '../collections/hooks'
import { useConfig } from '../app/config-context'
import { buildModuleMap, resolveModuleKey } from './create-routes.utils'
import { EagerMdxElement, resolveModuleLoader } from './mdx-elements'
import { DocsLayout } from '../app/docs-layout'

function CollectionIndex({
  indexContent,
  ListElement,
}: {
  indexContent: React.ReactNode
  ListElement: React.ComponentType
}) {
  return (
    <>
      {indexContent}
      <ListElement />
    </>
  )
}

function isCollectionIndexRoute(
  route: ComponentRoute,
  collection: string,
): boolean {
  const normalizedPath = route.path.replace(/\/$/, '')
  return (
    normalizedPath === `/${collection}` ||
    normalizedPath.endsWith(`/${collection}`)
  )
}

function getCollectionModule(
  route: ComponentRoute,
  moduleMap: Map<string, string>,
  mdxModules: Record<string, any>,
): { moduleKey?: string; moduleLoader: any } {
  const moduleKey = resolveModuleKey(route.filePath, moduleMap)
  return {
    moduleKey,
    moduleLoader: moduleKey ? mdxModules[moduleKey] : null,
  }
}

function DefaultCollectionList() {
  const location = useLocation()
  const config = useConfig()
  const loaderData = useLoaderData() as
    | {
        posts?: any[]
        totalPages?: number
        currentPage?: number
        collection?: string
      }
    | undefined

  const postsPerPage =
    (config.collections as { postsPerPage?: number } | undefined)
      ?.postsPerPage ?? 10

  // Derive base path by stripping any trailing /page/N segment. This works
  // regardless of custom base paths, locales, or nested prefixes.
  const basePath = location.pathname
    .replace(/\/page\/\d+\/?$/, '')
    .replace(/\/$/, '')
  const segments = basePath.split('/').filter(Boolean)
  const collection =
    (loaderData && loaderData.collection) || segments[segments.length - 1]

  const allPosts = usePosts(collection)
  const totalPages =
    (loaderData && loaderData.totalPages) ||
    Math.ceil(allPosts.length / postsPerPage)
  const currentPage =
    (loaderData && loaderData.currentPage) ||
    (() => {
      const match = location.pathname.match(/\/page\/(\d+)\/?$/)
      return match ? Number(match[1]) : 1
    })()

  const start = (currentPage - 1) * postsPerPage
  const posts =
    (loaderData && loaderData.posts) ||
    allPosts.slice(start, start + postsPerPage)

  if (!posts.length) return null

  return (
    <div className="py-8 max-w-2xl mx-auto px-4">
      <h1 className="text-3xl font-bold mb-6 capitalize">{collection}</h1>
      <div className="space-y-6">
        {posts.map((post) => (
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
      {totalPages > 1 && (
        <div className="mt-8 flex gap-4 text-sm">
          {currentPage > 1 && (
            <Link
              to={
                currentPage === 2
                  ? basePath
                  : `${basePath}/page/${currentPage - 1}`
              }
              className="text-primary-600 hover:underline"
            >
              Previous
            </Link>
          )}
          <span>
            Page {currentPage} of {totalPages}
          </span>
          {currentPage < totalPages && (
            <Link
              to={`${basePath}/page/${currentPage + 1}`}
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
    options.postsPerPage ??
    (config.collections as { postsPerPage?: number } | undefined)
      ?.postsPerPage ??
    10

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
  const defaultLocale = config.i18n?.defaultLocale || 'en'
  for (const [colName, colRoutes] of collectionsMap) {
    // Group by the effective locale and version encoded in route metadata.
    // The resolver has already produced canonical paths, so this keeps
    // versioned collections aligned with docs: version → locale → collection.
    const postsByVariant = new Map<string, ComponentRoute[]>()
    const indexByVariant = new Map<string, ComponentRoute>()
    for (const r of colRoutes) {
      const effectiveLocale = r.locale || defaultLocale
      const effectiveVersion = r.version || ''
      const key = `${effectiveVersion}::${effectiveLocale}`
      if (!postsByVariant.has(key)) postsByVariant.set(key, [])

      if (isCollectionIndexRoute(r, colName)) {
        indexByVariant.set(key, r)
      } else {
        postsByVariant.get(key)!.push(r)
      }
    }

    for (const [variant, variantRoutes] of postsByVariant) {
      const [version, locale] = variant.split('::')
      const localeRoutes = variantRoutes

      const colBase = buildUrl(
        {
          kind: 'collection',
          collection: colName,
          path: '/',
          locale: locale === defaultLocale ? undefined : locale,
          version: version || undefined,
        },
        {
          base: config.base,
          i18n: config.i18n,
          versions: config.versions,
          collections: [colName],
        },
      )

      localeRoutes.sort((a, b) => {
        const getTimestamp = (date: string | Date | undefined) => {
          if (!date) return Number.NEGATIVE_INFINITY
          const value = new Date(date).getTime()
          return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY
        }
        const da = getTimestamp(a.date)
        const db = getTimestamp(b.date)
        const dateOrder = db - da
        return dateOrder !== 0 ? dateOrder : a.path.localeCompare(b.path)
      })

      const colChildren: RouteRecord[] = []

      for (const route of localeRoutes) {
        const { moduleKey, moduleLoader } = getCollectionModule(
          route,
          moduleMap,
          mdxModules,
        )
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

        if (moduleLoader) {
          routeRecord.lazy = async () => {
            const mod = await resolveModuleLoader(moduleLoader as any)
            return {
              Component: function LoadedCollectionMdxRoute() {
                return (
                  <EagerMdxElement
                    key={`${moduleKey || subPath}-${locale}`}
                    moduleKey={moduleKey}
                    moduleLoader={mod}
                    route={route}
                    components={components as any}
                    collectionPostComponent={postComponent}
                  />
                )
              },
            }
          }
        } else {
          routeRecord.element = (
            <EagerMdxElement
              key={`${moduleKey || subPath}-${locale}`}
              moduleKey={moduleKey}
              moduleLoader={{} as any}
              route={route}
              components={components as any}
              collectionPostComponent={postComponent}
            />
          )
        }

        colChildren.push(routeRecord)

        metadata.push(route)
      }

      const totalPages = Math.ceil(localeRoutes.length / postsPerPage)
      const paginatedPosts = localeRoutes.map((r) => ({
        path: r.path,
        title: r.title,
        date: r.date,
        excerpt: r.excerpt,
        tags: r.tags,
        author: r.author,
        coverImage: r.coverImage,
        filePath: r.filePath,
        locale: r.locale,
        version: r.version,
        lastUpdated: r.lastUpdated,
        frontmatter: r.frontmatter,
      }))

      const listComponent = collectionLists?.[colName]
      const ListElement = listComponent || DefaultCollectionList
      const indexRoute = indexByVariant.get(variant)
      const indexRecord: RouteRecord = {
        index: true,
        path: '',
        loader: async () => ({
          posts: paginatedPosts.slice(0, postsPerPage),
          totalPages,
          currentPage: 1,
          collection: colName,
          ...(indexRoute
            ? {
                route: indexRoute,
                headings: indexRoute.headings || [],
                frontmatter: {
                  title: indexRoute.title,
                  description: indexRoute.description || '',
                  ...(indexRoute.frontmatter || {}),
                },
                filePath: indexRoute.filePath,
                locale: indexRoute.locale,
                version: indexRoute.version,
              }
            : {}),
        }),
        getStaticPaths: () => [''],
      }

      if (indexRoute) {
        const { moduleKey, moduleLoader } = getCollectionModule(
          indexRoute,
          moduleMap,
          mdxModules,
        )
        const postComponent = collectionPosts?.[colName]
        const createIndexContent = (resolvedModule: any) => (
          <EagerMdxElement
            key={`${moduleKey || colBase}-${locale}`}
            moduleKey={moduleKey}
            moduleLoader={resolvedModule}
            route={indexRoute}
            components={components as any}
            collectionPostComponent={postComponent}
          />
        )

        if (moduleLoader) {
          indexRecord.lazy = async () => {
            const mod = await resolveModuleLoader(moduleLoader as any)
            return {
              Component: function LoadedCollectionIndex() {
                return (
                  <CollectionIndex
                    indexContent={createIndexContent(mod)}
                    ListElement={ListElement}
                  />
                )
              },
            }
          }
        } else {
          indexRecord.element = (
            <CollectionIndex
              indexContent={createIndexContent({} as any)}
              ListElement={ListElement}
            />
          )
        }
      } else {
        indexRecord.element = <ListElement />
      }

      colChildren.unshift(indexRecord)

      metadata.push({
        path: colBase,
        locale,
        collection: colName,
        title: indexRoute?.title || colName,
        filePath: indexRoute?.filePath || '',
        componentPath: indexRoute?.componentPath || '',
        headings: indexRoute?.headings || [],
      } as unknown as ComponentRoute)

      for (let p = 2; p <= totalPages; p++) {
        const pagePath = `page/${p}`
        colChildren.push({
          path: pagePath,
          element: <ListElement />,
          loader: async () => ({
            posts: paginatedPosts.slice(
              (p - 1) * postsPerPage,
              p * postsPerPage,
            ),
            totalPages,
            currentPage: p,
            collection: colName,
          }),
          getStaticPaths: () => [pagePath],
        })

        metadata.push({
          path: `${colBase}/${pagePath}`.replace(/\/+/g, '/'),
          locale,
          collection: colName,
          title: colName,
          filePath: '',
          componentPath: '',
          headings: [],
        } as unknown as ComponentRoute)
      }

      const CustomLayout = collectionLayouts?.[colName]
      const CollectionLayout = CustomLayout || DocsLayout
      const blogLayoutRoute: RouteRecord = {
        path: colBase,
        element: (
          <CollectionLayout
            {...({ collectionsData: collectionsData || {} } as any)}
          />
        ),
        children: colChildren,
      }

      children.push(blogLayoutRoute)
    }
  }

  return { children, metadata }
}

export { buildCollectionRoutes }
