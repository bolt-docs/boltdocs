import { useDocRoute } from '@bdocs/runtime'
import { Contributors } from './contributors'

/**
 * Default `page:footer:start` slot. It reads the current route from the
 * document-route context, so the same component works in SSR and during
 * hydration.
 */
export function ContributorsSlot() {
  const route = useDocRoute()
  const contributors = route?.contributors
  if (!contributors || contributors.length === 0) return null
  return <Contributors contributors={contributors} />
}

export default ContributorsSlot
