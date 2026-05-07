import { useLoaderData } from 'react-router-dom'
import { DocPage } from '../app/doc-page'

/**
 * Renders an MDX page by consuming pre-loaded module data.
 * Uses DocPage to ensure consistent layout and metadata application.
 */
export function MdxPage({
  MDXComponent: propMDX,
  mdxComponents: propComponents,
}: any) {
  const data = useLoaderData() as any
  const MDXComponent = propMDX || data?.MDXComponent
  const components = propComponents || data?.mdxComponents
  console.log(data)
  if (!MDXComponent) return null

  return (
    <DocPage
      route={
        {
          path: data.path,
          filePath: data.filePath,
          title: data.frontmatter.title,
          description: data.frontmatter.description,
          headings: data.headings,
          locale: data.locale,
          version: data.version,
          group: data.group,
          groupTitle: data.groupTitle,
          lastUpdated: data.lastUpdated,
          frontmatter: data.frontmatter,
        } as any
      }
      content={MDXComponent}
      mdxComponents={components}
    />
  )
}
