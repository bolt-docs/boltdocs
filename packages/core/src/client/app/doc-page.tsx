import { useMdxComponents } from './mdx-components-context'
import { useMemo } from 'react'
import { LastUpdated as DefaultLastUpdated } from '../components/ui-base'

/**
 * DocPage renders the MDX content and page-specific metadata.
 * It is rendered inside the Outlet of DocsLayout.
 */
export function DocPage({
  route,
  content: Content,
  mdxComponents: propComponents,
}: any) {
  // Access global MDX components (defaults + plugins + virtuals) from context
  const contextComponents = useMdxComponents()

  // Merge components: Prop components (from loader) take priority,
  // then context components (globals).
  const allComponents = useMemo(
    () => ({
      LastUpdated: DefaultLastUpdated,
      ...contextComponents,
      ...propComponents,
    }),
    [contextComponents, propComponents],
  )

  const LastUpdated = allComponents.LastUpdated || DefaultLastUpdated

  if (!Content) return null

  return (
    <>
      <Content components={allComponents} />
      {route?.lastUpdated && <LastUpdated date={route.lastUpdated} />}
    </>
  )
}
