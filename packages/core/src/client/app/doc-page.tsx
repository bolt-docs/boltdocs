import UserLayout from 'virtual:boltdocs-layout'
import { useMdxComponents } from './mdx-components-context'
import { useMemo } from 'react'
import { LastUpdated as DefaultLastUpdated } from '../components/ui-base'

/**
 * DocPage is a layout wrapper for documentation content during SSG.
 * It renders the user-defined layout (or default) around the MDX content.
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
    <UserLayout route={route}>
      <Content components={allComponents} />
      <LastUpdated date={route.lastUpdated} />
    </UserLayout>
  )
}
