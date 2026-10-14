import { useLoaderData } from '../router'
import { DocPage } from '../app/doc-page'
import { CurrentPostProvider } from '../collections/collections-context'
import { useMdxComponents } from '../app/mdx-components-context'
import type { CollectionPostLoaderData, ComponentRoute } from '../types'

type MdxPageProps = {
  MDXComponent: React.ComponentType<React.PropsWithChildren<unknown>>
  mdxComponents: Record<string, React.ComponentType<HTMLElement>>
  collectionPostComponent?: React.ComponentType<any>
  /**
   * Name of the collection this route belongs to, when it has one.
   *
   * The layout must not depend on data that arrives asynchronously. Route
   * metadata is known synchronously from the route table, whereas the loader
   * data is not: on the client the first render happens with no loader data,
   * because the generated entry declares `hasLoaderData={false}`. Deciding the
   * layout from the loader therefore picked the documentation layout for a
   * collection post, while the server had rendered the collection layout. React
   * saw two different first children and discarded the whole page (error #418).
   *
   * A project that declares a collection should not have to know this, so the
   * route table supplies the answer directly and the loader is only a fallback
   * for callers that render `MdxPage` directly.
   */
  collection?: string
  /**
   * Route metadata for the current page, when known synchronously.
   *
   * `usePost()` reads from `CurrentPostProvider`, and a collection layout calls
   * it on its first render. Passing the route keeps that first render complete
   * instead of rendering a header with no title and then filling it in.
   */
  route?: ComponentRoute
}

/**
 * Renders an MDX page by consuming pre-loaded route data.
 *
 * - If the route belongs to a collection, wraps the content with
 *   `CurrentPostProvider` so that `usePost()` (called without a slug) can read
 *   the current post's data from context.
 * - Otherwise, renders the standard `DocPage` layout.
 */
export function MdxPage({
  MDXComponent,
  mdxComponents: propComponents,
  collectionPostComponent: CollectionPost,
  collection,
  route: routeProp,
}: MdxPageProps) {
  const data = useLoaderData()
  const contextComponents = useMdxComponents()
  const mdxComponents = { ...contextComponents, ...propComponents }

  if (!MDXComponent) return null

  const collectionData = (data as unknown as CollectionPostLoaderData) || {}
  const isCollection = collection
    ? true
    : !!collectionData?.collection && !!collectionData?.route
  /**
   * The loader's own copy of the route, falling back to the route table so the
   * first client render has the same metadata the server used.
   */
  const postRoute = collectionData.route ?? routeProp
  const postHeadings = collectionData.headings ?? routeProp?.headings ?? []

  if (isCollection) {
    const postElement = CollectionPost ? (
      <CollectionPost
        MDXComponent={MDXComponent}
        mdxComponents={mdxComponents}
      />
    ) : (
      <DocPage
        route={{
          path: postRoute?.path || '',
          filePath: postRoute?.filePath || '',
          title: postRoute?.title,
          description: postRoute?.description,
          headings: postHeadings,
          locale: postRoute?.locale,
          version: postRoute?.version,
          lastUpdated: postRoute?.lastUpdated,
          frontmatter: postRoute?.frontmatter,
        }}
        content={MDXComponent}
        mdxComponents={mdxComponents}
      />
    )

    return (
      <CurrentPostProvider
        value={{
          route: postRoute,
          headings: postHeadings,
          collection: collection ?? collectionData.collection,
        }}
      >
        {postElement}
      </CurrentPostProvider>
    )
  }

  const docData = (data as any) || {}
  return (
    <DocPage
      route={{
        path: docData?.path || '',
        filePath: docData?.filePath || '',
        title: docData?.frontmatter?.title,
        description: docData?.frontmatter?.description,
        headings: docData?.headings || [],
        locale: docData?.locale,
        version: docData?.version,
        group: docData?.group,
        groupTitle: docData?.groupTitle,
        lastUpdated: docData?.lastUpdated,
        frontmatter: docData?.frontmatter,
      }}
      content={MDXComponent}
      mdxComponents={mdxComponents}
    />
  )
}
