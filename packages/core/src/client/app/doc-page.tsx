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

  // Render dynamic frontmatter components if they exist
  const formatters: React.ReactNode[] = []
  if (route?.frontmatter) {
    const standardKeys = new Set([
      'title',
      'description',
      'permalink',
      'sidebarPosition',
      'sidebarLabel',
      'sidebarHidden',
      'hidden',
      'category',
      'order',
      'badge',
      'icon',
      'date',
      'lastUpdated',
      'groupTitle',
      'groupPosition',
      'seo',
    ])
    Object.entries(route.frontmatter).forEach(([key, value]) => {
      if (standardKeys.has(key)) return
      console.log(key, value)
      const FormatterComponent = allComponents[`Frontmatter_${key}`]
      if (FormatterComponent) {
        formatters.push(
          <FormatterComponent key={key} data={value} route={route} />,
        )
      }
    })
  }

  return (
    <>
      {formatters.length > 0 && (
        <div className="boltdocs-frontmatter-formatters mb-8 flex flex-col gap-4">
          {formatters}
        </div>
      )}
      <Content components={allComponents} />
      {route?.lastUpdated && <LastUpdated date={route.lastUpdated} />}
    </>
  )
}
