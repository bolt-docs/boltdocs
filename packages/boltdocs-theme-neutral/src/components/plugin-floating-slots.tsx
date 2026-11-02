import { lazy, Suspense } from 'react'
import { getClientSlots } from '@bdocs/runtime'

// `floating:after` is the one lazy slot: it mounts once in the app shell and
// may pull a large bundle, so the registry hands the theme a loader instead of
// a component.
const floatingEntries = getClientSlots()['floating:after'] ?? []
const floatingComponents = floatingEntries.flatMap((entry) =>
  entry.load ? [{ id: entry.id, Component: lazy(entry.load) }] : [],
)

export function PluginFloatingSlots() {
  if (floatingComponents.length === 0) return null

  return (
    <Suspense fallback={null}>
      {floatingComponents.map(({ id, Component }) => (
        <Component key={id} />
      ))}
    </Suspense>
  )
}
