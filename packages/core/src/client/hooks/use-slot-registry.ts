import type { ComponentType } from 'react'
import type { ComponentRoute } from '../types'
import slotRegistry from 'virtual:boltdocs-layout-slots'

export type SlotComponent = ComponentType<
  { route?: ComponentRoute } | undefined
>

export interface SlotRegistry {
  readonly 'floating-bottom'?: readonly SlotComponent[]
  readonly 'right-rail'?: readonly SlotComponent[]
  readonly 'navbar-extra'?: readonly SlotComponent[]
  readonly 'header-extra'?: readonly SlotComponent[]
  readonly 'toc-extra'?: readonly SlotComponent[]
  readonly 'footer-extra'?: readonly SlotComponent[]
  readonly 'body-portal'?: readonly SlotComponent[]
  readonly [key: string]: readonly SlotComponent[] | undefined
}

/**
 * Returns the slot registry keyed by slot id.
 * Safe to call repeatedly — returns the same reference unless the virtual
 * module is invalidated by HMR.
 */
export function useSlotRegistry(): SlotRegistry {
  return RAW_REGISTRY
}

/**
 * Returns the components registered for a specific slot id, in mount order.
 * Returns an empty array if the slot has no contributors.
 */
export function useSlotComponents(
  slotId: string,
): readonly SlotComponent[] {
  return slotRegistry[slotId] ?? EMPTY
}

const EMPTY: readonly SlotComponent[] = Object.freeze([])
