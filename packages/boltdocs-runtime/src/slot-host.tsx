import * as React from 'react'
import { getClientSlots } from './site-bridge'

/**
 * Runtime-owned rendering for plugin slots.
 *
 * The engine emits the slot table and the site bridge transports it; mounting
 * mechanics (filtering malformed entries, `lazy`, `Suspense`) are behavior, not
 * appearance, so they live here instead of in every theme. Themes decide *where*
 * a slot is mounted, never *how* it is mounted.
 */

export interface PluginSlotProps {
  /** Slot name declared by a plugin through `client.slots`. */
  name: string
  [key: string]: unknown
}

/** Renders every eager plugin component registered for a slot. */
export function PluginSlot({ name, ...props }: PluginSlotProps) {
  const entries = getClientSlots()[name] ?? []
  const components = entries.filter(
    (
      entry,
    ): entry is typeof entry & {
      Component: React.ComponentType<Record<string, unknown>>
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

PluginSlot.displayName = 'PluginSlot'

/**
 * Mounts the lazy `floating:after` slot once, inside a Suspense boundary.
 *
 * Read at render time rather than module scope so a bridge registration that
 * happens after import is still picked up.
 */
export function FloatingSlots(): React.ReactElement | null {
  const entries = React.useMemo(
    () => getClientSlots()['floating:after'] ?? [],
    [],
  )
  const components = React.useMemo(
    () =>
      entries.flatMap((entry) =>
        entry.load ? [{ id: entry.id, Component: React.lazy(entry.load) }] : [],
      ),
    [entries],
  )

  if (components.length === 0) return null

  return (
    <React.Suspense fallback={null}>
      {components.map(({ id, Component }) => (
        <Component key={id} />
      ))}
    </React.Suspense>
  )
}

FloatingSlots.displayName = 'FloatingSlots'
