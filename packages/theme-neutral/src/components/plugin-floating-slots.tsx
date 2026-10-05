import { lazy, Suspense } from 'react'
import { getClientSlots } from '@bdocs/runtime'

const floatingEntries = getClientSlots()['floating:after'] ?? []
const floatingComponents = floatingEntries.map((entry) => ({
  id: entry.id,
  Component: lazy(entry.load),
}))

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
