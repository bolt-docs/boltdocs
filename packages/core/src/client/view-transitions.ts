import { useCallback, useMemo } from 'react'
import { useOptionalConfig } from './app/config-context'
import type { BoltdocsViewTransitionsConfig } from '../shared/types'

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
 * Starts a native document transition when the browser supports it. On older
 * browsers, the update still runs normally and the function returns null.
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
        types: options?.types || configuredTypes,
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
      }),
    [enabled, run, supported],
  )
}
