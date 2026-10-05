import { useCallback, useMemo } from 'react'
import { useOptionalConfig } from './config-context'
import type { BoltdocsViewTransitionsConfig } from './contract-types'

export interface ViewTransitionOptions {
  /** Enable or disable this individual transition. */
  enabled?: boolean
  /** Transition types forwarded to the native API. */
  types?: string[]
}

export interface ViewTransitionHandle {
  finished?: Promise<unknown>
  ready?: Promise<unknown>
  updateCallbackDone?: Promise<unknown>
  skipTransition?: () => void
}

type NativeViewTransitionDocument = {
  startViewTransition?: (options?: {
    update: ViewTransitionUpdate
    types?: string[]
  }) => ViewTransitionHandle
}

export type ViewTransitionUpdate = () => void | Promise<void>

/** Navigation direction used to pick a directional transition type. */
export type NavigationDirection = 'forward' | 'back' | 'none'

export interface ViewTransitionRunner {
  (
    update: ViewTransitionUpdate,
    options?: ViewTransitionOptions,
  ): ViewTransitionHandle | null
  /** Alias for the callable form, useful for event handlers and callbacks. */
  run: (
    update: ViewTransitionUpdate,
    options?: ViewTransitionOptions,
  ) => ViewTransitionHandle | null
  /** Explicit alias for code that reads like an imperative action. */
  start: (
    update: ViewTransitionUpdate,
    options?: ViewTransitionOptions,
  ) => ViewTransitionHandle | null
  /** Whether the project has enabled the experimental integration. */
  enabled: boolean
  /** Whether the current browser exposes the native API. */
  supported: boolean
  /** Whether the visitor asked the OS to reduce motion. */
  reducedMotion: boolean
}

function resolveOptions(
  options?: ViewTransitionOptions,
): BoltdocsViewTransitionsConfig | undefined {
  if (options?.enabled === false) return undefined
  return {
    enabled: true,
    ...(options?.types?.length ? { types: options.types } : {}),
  }
}

function isNativeViewTransitionSupported(): boolean {
  return (
    typeof document !== 'undefined' &&
    typeof (document as unknown as NativeViewTransitionDocument)
      .startViewTransition === 'function'
  )
}

/**
 * Honors the `prefers-reduced-motion` media query.
 *
 * View transitions animate the whole document, so ignoring this setting turns
 * an accessibility preference into a motion-sensitivity regression. The check
 * is live: a visitor can change the OS setting without reloading the page.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * Combines the configured transition types with a navigation direction.
 *
 * The direction is always appended as a type so themes can animate forward and
 * backward navigation differently without writing router code.
 */
export function resolveTransitionTypes(
  configured: string[] | undefined,
  direction: NavigationDirection = 'none',
): string[] | undefined {
  const types = [...(configured ?? [])]
  if (direction !== 'none' && !types.includes(direction)) {
    types.push(direction)
  }
  return types.length > 0 ? types : undefined
}

/**
 * Starts a native document transition when the browser supports it and the
 * visitor has not asked for reduced motion. Otherwise the update still runs
 * normally and the function returns null.
 */
export function startViewTransition(
  update: ViewTransitionUpdate,
  options?: ViewTransitionOptions,
): ViewTransitionHandle | null {
  const resolved = resolveOptions(options)
  if (typeof document === 'undefined' || resolved?.enabled !== true) {
    void update()
    return null
  }

  if (prefersReducedMotion()) {
    void update()
    return null
  }

  const start = (document as unknown as NativeViewTransitionDocument)
    .startViewTransition
  if (!start) {
    void update()
    return null
  }

  const types = options?.types
  return start.call(document, {
    update,
    ...(types?.length ? { types } : {}),
  })
}

/**
 * Returns a transition-aware runner that follows the project's experimental
 * configuration. It is safe to use in custom layouts and external pages.
 *
 * The returned value is callable for backwards compatibility:
 * `transition(() => setState(...))`. It also exposes `run` and `start` aliases
 * for discoverability in editor autocomplete.
 */
export function useViewTransition(): ViewTransitionRunner {
  const config = useOptionalConfig()
  const configured = config?.experimental?.viewTransitions
  const enabled =
    configured === true ||
    (typeof configured === 'object' && configured.enabled === true)
  const supported = isNativeViewTransitionSupported()
  const reducedMotion = prefersReducedMotion()

  const run = useCallback(
    (update: ViewTransitionUpdate, options?: ViewTransitionOptions) => {
      if (!enabled && options?.enabled !== true) {
        void update()
        return null
      }

      const configuredTypes =
        typeof configured === 'object' ? configured.types : undefined
      return startViewTransition(update, {
        ...options,
        types: resolveTransitionTypes(
          options?.types ?? configuredTypes,
          'none',
        ),
      })
    },
    [configured, enabled],
  )

  return useMemo(
    () =>
      Object.assign(run, {
        run,
        start: run,
        enabled,
        supported,
        reducedMotion,
      }),
    [enabled, reducedMotion, run, supported],
  )
}
