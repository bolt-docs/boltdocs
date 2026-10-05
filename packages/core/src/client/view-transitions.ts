/**
 * Re-exported from `@bdocs/runtime`; see the package for the implementation.
 *
 * Named rather than `export *` so this path keeps exporting exactly the seven
 * names it exported before the move, not whatever the runtime grows next.
 */
export {
  prefersReducedMotion,
  resolveTransitionTypes,
  startViewTransition,
  useViewTransition,
  type ViewTransitionHandle,
  type ViewTransitionOptions,
  type ViewTransitionRunner,
  type ViewTransitionUpdate,
} from '@bdocs/runtime'
