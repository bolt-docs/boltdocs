import { useMergedComponents } from '../hooks/use-merged-components'

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
  const LastUpdated = allComponents.LastUpdated

  if (!Content) return null

  return (
    <>
      <Content components={allComponents} />
      {route?.lastUpdated && <LastUpdated date={route.lastUpdated} />}
    </>
  )
}
