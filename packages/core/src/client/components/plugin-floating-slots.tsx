import { lazy, Suspense } from 'react'
import type { ComponentType } from 'react'
import pluginSlots from 'virtual:boltdocs-client-registry'

interface ClientSlotModule {
  default: ComponentType<unknown>
}

interface ClientSlotEntry {
  id: string
  load: () => Promise<ClientSlotModule>
}

type ClientSlotRegistry = Record<string, ClientSlotEntry[]>

const floatingEntries =
  (pluginSlots as ClientSlotRegistry)['floating:after'] ?? []
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
