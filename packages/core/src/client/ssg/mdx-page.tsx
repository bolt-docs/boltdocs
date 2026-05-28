import { useLoaderData } from 'react-router-dom'
import { DocPage } from '../app/doc-page'
import { BlogPost } from '../collections'
import type { CollectionPostLoaderData } from '../types'

type MdxPageProps = {
  MDXComponent: React.ComponentType<React.PropsWithChildren<unknown>>
  mdxComponents: Record<string, React.ComponentType<HTMLElement>>
}

/**
 * Renders an MDX page by consuming pre-loaded route data.
 *
 * - If the route belongs to a collection (`data.collection` is set), renders
 *   a `BlogPost` layout.
 * - Otherwise, renders the standard `DocPage` layout.
 *
 * The `MDXComponent` and `mdxComponents` are passed down from
 * `LazyMdxElement` / `EagerMdxElement` after the module is resolved.
 */
export function MdxPage({
  MDXComponent,
  mdxComponents: propComponents,
}: MdxPageProps) {
  const data = useLoaderData()

  if (!MDXComponent) return null

  // Collection post route — delegate to BlogPost which reads CollectionPostLoaderData
  if ((data as CollectionPostLoaderData)?.collection) {
    return <BlogPost MDXComponent={MDXComponent} mdxComponents={propComponents} />
  }

  // Standard doc page route
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
