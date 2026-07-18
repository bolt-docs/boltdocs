import type { ComponentType } from 'react'
import { useState, useEffect, type ReactNode } from 'react'
import type { ComponentRoute } from '../types'
import * as _slotModule from 'virtual:boltdocs-layout-slots'

// Read the default export (slotRegistry) and named exports from the namespace.
// We use a namespace import (`import *`) instead of named destructuring so
// the module doesn't throw a SyntaxError when older generated modules lack
// slotConditions / slotSsrFlags / slotLazyFlags. Properties that don't exist
// on the namespace object safely resolve to `undefined`, which the `?? {}
// fallbacks below handle gracefully.
const slotRegistry: Record<string, any> = _slotModule.default ?? {}
const _rawSlotConditions: Record<string, Array<object | null>> | undefined = (
  _slotModule as any
).slotConditions
const _rawSlotSsrFlags: Record<string, Array<boolean>> | undefined = (
  _slotModule as any
).slotSsrFlags
const _rawSlotLazyFlags: Record<string, Array<boolean>> | undefined = (
  _slotModule as any
).slotLazyFlags

// slotConditions is emitted by the generator alongside the registry.
// Each entry is a parallel array: null = always render,
// else { collection?, path?, locale?, tag? }.
// When the generated module hasn't been rebuilt yet, _rawSlotConditions
// will be undefined — we fall back to {} (backward compat: render all).
const _slotConditions: Record<
  string,
  Array<object | null>
> = _rawSlotConditions ?? {}

// slotSsrFlags is a parallel boolean map: true = render during SSR,
// false = client-only. Backward compat: default to true (render all).
const _slotSsrFlags: Record<string, Array<boolean>> = _rawSlotSsrFlags ?? {}

// slotLazyFlags is a parallel boolean map: true = lazy-load via
// React.lazy + Suspense, false = normal. Backward compat: default false.
const _slotLazyFlags: Record<string, Array<boolean>> = _rawSlotLazyFlags ?? {}

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
  return slotRegistry as unknown as SlotRegistry
}

/**
 * Returns the components registered for a specific slot id, in mount order.
 * Returns an empty array if the slot has no contributors.
 */
export function useSlotComponents(slotId: string): readonly SlotComponent[] {
  return slotRegistry[slotId] ?? EMPTY
}

/**
 * Filters slot components by their declared `if` conditions against the
 * current route. Returns only components whose conditions match (or that
 * have no condition set).
 */
export function useConditionalSlotComponents(
  slotId: string,
  route: ComponentRoute | undefined,
): readonly SlotComponent[] {
  const components = slotRegistry[slotId]
  if (!components || components.length === 0) return EMPTY

  const conds = _slotConditions[slotId]
  if (!conds || conds.length === 0) {
    // No conditions declared — render all components (backward compat).
    return components
  }

  const filtered: SlotComponent[] = []
  for (let i = 0; i < components.length; i++) {
    const cond = conds[i]
    if (!cond || matchesCondition(cond, route)) {
      filtered.push(components[i])
    }
  }
  return filtered.length === 0
    ? EMPTY
    : (Object.freeze(filtered) as readonly SlotComponent[])
}

/** @internal — exported for testing */
export function matchesCondition(
  cond: object | null,
  route: ComponentRoute | undefined,
): boolean {
  if (cond == null) return true // null = always render (handled upstream but defensive)
  if (!route) {
    // No route context — conditions can't be evaluated, so skip.
    return false
  }
  const c = cond as {
    collection?: string
    path?: string
    locale?: string
    tag?: string
  }
  if (c.collection && route.collection !== c.collection) return false
  if (c.locale && route.locale !== c.locale) return false
  if (c.tag && !route.tags?.includes(c.tag)) return false
  if (c.path && (!route.path || !route.path.match(c.path))) return false
  return true
}

/**
 * A slot component with its SSR and lazy flags.
 * When `clientOnly` is true, the component should be wrapped in
 * `<ClientOnly>` to prevent rendering during SSR.
 * When `lazy` is true, the component should be wrapped in
 * `<Suspense>` for lazy loading.
 */
export interface SlotWithSSR {
  component: SlotComponent
  clientOnly: boolean
  lazy: boolean
}

/**
 * ClientOnly wrapper: renders children only after hydration.
 * During SSR and before hydration, renders nothing to avoid
 * content mismatch warnings for components that depend on
 * browser APIs (window, localStorage, etc.).
 */
export function ClientOnly({ children }: { children: ReactNode }): ReactNode {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  if (!mounted) return null
  return children
}

/**
 * Like `useConditionalSlotComponents`, but also respects the `ssr` flag.
 * Components with `clientOnly: true` should be wrapped in `<ClientOnly>`
 * so they only render after hydration.
 */
export function useSSRSafeSlotComponents(
  slotId: string,
  route: ComponentRoute | undefined,
): readonly SlotWithSSR[] {
  const components = slotRegistry[slotId]
  if (!components || components.length === 0) return EMPTY_SLOTS

  const conds = _slotConditions[slotId]
  const flags = _slotSsrFlags[slotId]

  const lazyFlags = _slotLazyFlags[slotId]

  const filtered: SlotWithSSR[] = []
  for (let i = 0; i < components.length; i++) {
    const cond = conds?.[i]
    if (cond && !matchesCondition(cond, route)) continue
    const ssr = flags?.[i] ?? true
    filtered.push({
      component: components[i] as SlotComponent,
      clientOnly: !ssr,
      lazy: lazyFlags?.[i] ?? false,
    })
  }
  return filtered.length === 0 ? EMPTY_SLOTS : Object.freeze(filtered)
}

const EMPTY: readonly SlotComponent[] = Object.freeze([])
const EMPTY_SLOTS: readonly SlotWithSSR[] = Object.freeze([])
