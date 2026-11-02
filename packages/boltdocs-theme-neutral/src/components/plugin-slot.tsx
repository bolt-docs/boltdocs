import type { ComponentType } from 'react'
import { getClientSlots } from '@bdocs/runtime'

interface EagerSlotEntry {
  id: string
  Component?: ComponentType<Record<string, unknown>>
}

export interface PluginSlotProps {
  /** Slot name declared by a plugin through `client.slots`. */
  name: string
  [key: string]: unknown
}

/**
 * Renders every plugin component registered for an eager slot.
 *
 * The slots reach this package through the runtime's site bridge rather than a
 * `virtual:boltdocs-client-registry` import: a theme has to be installable on
 * its own, and only the core can resolve a virtual module. Slots other than
 * `floating:after` are imported statically by the generated registry, so they
 * participate in server rendering and hydration without a Suspense boundary.
 * Unknown slots render nothing.
 */
export function PluginSlot({ name, ...props }: PluginSlotProps) {
  const entries = (getClientSlots()[name] ?? []) as EagerSlotEntry[]
  const components = entries.filter(
    (
      entry,
    ): entry is EagerSlotEntry & {
      Component: ComponentType<Record<string, unknown>>
    } => typeof entry.Component === 'function',
  )

  if (components.length === 0) return null

  return (
    <>
      {components.map(({ id, Component }) => (
        <Component key={id} {...props} />
      ))}
    </>
  )
}
