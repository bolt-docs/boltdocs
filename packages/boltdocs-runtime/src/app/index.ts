/**
 * The application layer: what the build drives.
 *
 * `createRoutes` builds the route table, the shell mounts the providers, and
 * `MdxPage` decides what a documentation page renders. None of it decides how
 * anything looks — the theme arrives as an argument and this layer only asks it
 * for the components a route needs.
 *
 * It lives behind its own entry (`@bdocs/runtime/app`) because a reader's first
 * visit should download the theme's components, not the route builder that only
 * the build needs.
 */
export { createRoutes } from './create-routes'
export type { CreateRoutesOptions } from './create-routes'
export { BoltdocsShell } from './shell'
export { MdxPage } from './mdx-page'
export type { BoltdocsTheme, DocPageProps, DocPageRoute } from './theme'

// The router primitives the generated entry re-exports on `createRoot`.
export {
  RouteRenderer,
  matchRouteBranch,
  matchRouteBranchWithParams,
  resolveRouteBranch,
} from '../router'
