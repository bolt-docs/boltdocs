/**
 * The theme's build-time surface.
 *
 * `createRoutes` builds the route table the application renders, and the shell
 * mounts it. Neither belongs in the theme's main entry: a site that imports
 * one component — `cn`, a `Link`, a hook — should not download the route
 * builder with it.
 *
 * The engine imports this entry, not the main one. That is the whole reason it
 * is a separate file: the engine needs the route surface, and the engine's
 * import is what keeps it out of a reader's first visit.
 */
export { createRoutes, BoltdocsShell, MdxPage } from './index'
export type { CreateRoutesOptions } from './index'

/**
 * The router primitives the build drives.
 *
 * They belong to the runtime, and a theme re-exports the ones its own entry
 * point needs so a build only has to resolve one package for the client half.
 */
export {
  RouteRenderer,
  matchRouteBranch,
  matchRouteBranchWithParams,
  resolveRouteBranch,
} from '@bdocs/runtime'
