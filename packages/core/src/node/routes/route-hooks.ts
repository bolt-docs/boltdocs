import type { BoltdocsConfig } from '../config'
import type { RouteMeta } from './types'

/**
 * Returns true when at least one configured plugin declares the
 * `routes:resolved` lifecycle hook.
 *
 * The check stays synchronous and dependency-free so route generation for
 * projects without plugins never pays for loading the plugin lifecycle.
 */
export function hasRoutesResolvedHook(config?: BoltdocsConfig): boolean {
  return (config?.plugins ?? []).some((plugin) => {
    const hooks = plugin.hooks as Record<string, unknown> | null | undefined
    return typeof hooks?.['routes:resolved'] === 'function'
  })
}

/**
 * Runs the `routes:resolved` hook chain over the generated route list.
 *
 * The hook is documented as the point where plugins can enrich route
 * metadata (last-updated dates, contributors, reading time, ...) after every
 * documentation route has been crawled, normalized and sorted. It must run
 * on the exact array that is about to be returned so both the SSG route table
 * and the client `virtual:boltdocs-routes` module see the enriched metadata.
 *
 * Plugin errors are isolated by the lifecycle manager, and any unexpected
 * failure here degrades to the unenriched routes instead of failing the
 * build.
 */
export async function runRoutesResolvedHook(
  routes: RouteMeta[],
  config: BoltdocsConfig | undefined,
  docsDir: string,
): Promise<RouteMeta[]> {
  if (!hasRoutesResolvedHook(config)) return routes

  try {
    const { PluginLifecycleManager } = await import(
      '../plugins/plugin-lifecycle'
    )
    const manager = new PluginLifecycleManager(
      config?.plugins ?? [],
      config as BoltdocsConfig,
      docsDir,
      process.cwd(),
      routes,
    )

    const result = await manager.runChain('routes:resolved', { routes })
    return Array.isArray(result.routes) ? result.routes : routes
  } catch {
    return routes
  }
}
