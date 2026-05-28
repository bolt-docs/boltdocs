import { useLoaderData } from 'react-router-dom'
import { DocPage } from '../app/doc-page'
import type { CollectionPostLoaderData } from '../types'

type MdxPageProps = {
  MDXComponent: React.ComponentType<React.PropsWithChildren<unknown>>
  mdxComponents: Record<string, React.ComponentType<HTMLElement>>
  collectionPostComponent?: React.ComponentType<any>
}

/**
 * Renders an MDX page by consuming pre-loaded route data.
 *
 * - If the route belongs to a collection (`data.collection` is set), renders
 *   the custom post component if provided, else falls back to the standard DocPage.
 * - Otherwise, renders the standard `DocPage` layout.
 */
export function MdxPage({
  MDXComponent,
  mdxComponents: propComponents,
  collectionPostComponent: CollectionPost,
}: MdxPageProps) {
  const data = useLoaderData()

  if (!MDXComponent) return null

  // If this is a collection post, delegate to the custom component if available.
  // Otherwise, or if not in a collection, render using DocPage.
  const isCollection = !!(data as CollectionPostLoaderData)?.collection

  if (isCollection && CollectionPost) {
    return (
      <CollectionPost
        MDXComponent={MDXComponent}
        mdxComponents={propComponents}
      />
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
