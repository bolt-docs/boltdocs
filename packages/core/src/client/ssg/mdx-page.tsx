import { useLoaderData } from 'react-router-dom'
import { DocPage } from '../app/doc-page'
import { CurrentPostProvider } from '../collections/collections-context'
import type { CollectionPostLoaderData } from '../types'

type MdxPageProps = {
  MDXComponent: React.ComponentType<React.PropsWithChildren<unknown>>
  mdxComponents: Record<string, React.ComponentType<HTMLElement>>
  collectionPostComponent?: React.ComponentType<any>
}

/**
 * Renders an MDX page by consuming pre-loaded route data.
 *
 * - If the route belongs to a collection (`data.collection` is set), wraps
 *   the content with `CurrentPostProvider` so that `usePost()` (called without
 *   a slug) can read the current post's data from context.
 * - Otherwise, renders the standard `DocPage` layout.
 */
export function MdxPage({
  MDXComponent,
  mdxComponents: propComponents,
  collectionPostComponent: CollectionPost,
}: MdxPageProps) {
  const data = useLoaderData()

  if (!MDXComponent) return null

  const collectionData = data as CollectionPostLoaderData
  const isCollection = !!collectionData?.collection

  if (isCollection) {
    const postElement = CollectionPost ? (
      <CollectionPost
        MDXComponent={MDXComponent}
        mdxComponents={propComponents}
      />
    ) : (
      <DocPage
        route={{
          path: collectionData.route.path,
          filePath: collectionData.route.filePath,
          title: collectionData.route.title,
          description: collectionData.route.description,
          headings: collectionData.headings,
          locale: collectionData.route.locale,
          version: collectionData.route.version,
          lastUpdated: collectionData.route.lastUpdated,
          frontmatter: collectionData.route.frontmatter,
        }}
        content={MDXComponent}
        mdxComponents={propComponents}
      />
    )

    return (
      <CurrentPostProvider
        value={{
          route: collectionData.route,
          headings: collectionData.headings,
          collection: collectionData.collection,
        }}
      >
        {postElement}
      </CurrentPostProvider>
    )
  }

  const docData = data as any
  return (
    <DocPage
      route={{
        path: docData.path,
        filePath: docData.filePath,
        title: docData.frontmatter?.title,
        description: docData.frontmatter?.description,
        headings: docData.headings,
        locale: docData.locale,
        version: docData.version,
        group: docData.group,
        groupTitle: docData.groupTitle,
        lastUpdated: docData.lastUpdated,
        frontmatter: docData.frontmatter,
      }}
      content={MDXComponent}
      mdxComponents={propComponents}
    />
  )
}
