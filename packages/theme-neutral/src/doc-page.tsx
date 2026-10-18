import type { ReactNode } from 'react'
import { LastUpdated as DefaultLastUpdated } from './components/mdx/last-updated'
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
  // A site may provide its own footer through `mdx-components.tsx`, and it wins
  // when it does. Otherwise the theme's footer renders, and that is deliberate:
  // it is the host of the `page:footer:start` plugin slot, so a contributors
  // plugin has somewhere to mount without every site wiring a component by
  // hand. It only renders for a route that has a date or contributors, which is
  // when there is anything to say.
  const SiteLastUpdated = allComponents.LastUpdated as
    | ((props: { date?: string | number | Date }) => ReactNode)
    | undefined
  const PageFooter = SiteLastUpdated ?? DefaultLastUpdated
  if (!Content) return null

  return (
    <>
      <Content components={allComponents} />
      {(route?.lastUpdated || route?.contributors?.length) && (
        <PageFooter date={route?.lastUpdated} />
      )}
    </>
  )
}
