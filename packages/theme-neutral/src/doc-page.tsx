import type { ReactNode } from 'react'
import { useMergedComponents } from './hooks/use-merged-components'

/**
 * DocPage renders the MDX content and page-specific metadata.
 * It is rendered inside the Outlet of DocsLayout.
 */
export function DocPage({
  route,
  content: Content,
  mdxComponents: propComponents,
}: any) {
  const allComponents = useMergedComponents(propComponents)
  // Optional. The theme does not ship a "last updated" widget — it is a
  // site-specific detail with no default answer — so a site or a plugin provides
  // it through `mdx-components.tsx`. Destructuring it unconditionally and
  // rendering it would crash the page for every site that opts out.
  const LastUpdated = allComponents.LastUpdated as
    | ((props: { date: string | number | Date }) => ReactNode)
    | undefined
  if (!Content) return null

  return (
    <>
      <Content components={allComponents} />
      {route?.lastUpdated && LastUpdated && (
        <LastUpdated date={route.lastUpdated} />
      )}
    </>
  )
}
