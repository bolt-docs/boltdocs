import type { ComponentType } from 'react'
import pluginSlots from 'virtual:boltdocs-client-registry'

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
 * Slots other than `floating:after` are statically imported by the generated
 * client registry, so they participate in server rendering and hydration
 * without a Suspense boundary. Unknown slots render nothing.
 */
export function PluginSlot({ name, ...props }: PluginSlotProps) {
  const entries = (pluginSlots[name] ?? []) as EagerSlotEntry[]
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
