import { ViteReactSSG } from '@bdocs/ssg'
import {
  RouteRenderer,
  matchRouteBranch,
  matchRouteBranchWithParams,
  resolveRouteBranch,
} from '@bdocs/runtime/app'

/**
 * Builds the client root for a React Boltdocs site.
 *
 * The engine generates the route table and the theme surface; this binding is
 * the only place that knows those are React components. The helpers are
 * attached to the root because the generated entry and the SSG renderer read
 * them from there.
 */
export function createRoot(routes: unknown): unknown {
  const root = ViteReactSSG(
    routes as Parameters<typeof ViteReactSSG>[0],
    () => {
      // Boltdocs initialization hook — currently nothing to do on the client.
    },
  ) as unknown as Record<string, unknown>

  root.RouteRenderer = RouteRenderer
  root.matchRouteBranch = matchRouteBranch
  root.matchRouteBranchWithParams = matchRouteBranchWithParams
  root.resolveRouteBranch = resolveRouteBranch
  return root
}
