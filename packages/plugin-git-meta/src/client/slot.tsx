import { useRoutes } from 'boltdocs/client'
import { Contributors } from './contributors'

/**
 * Default `page:footer:start` slot. It reads the current route from the router
 * context, so the same component works in SSR and during hydration.
 */
export function ContributorsSlot() {
  const { currentRoute } = useRoutes()
  const contributors = currentRoute?.contributors
  if (!contributors || contributors.length === 0) return null
  return <Contributors contributors={contributors} />
}

export default ContributorsSlot
