import path from 'node:path'
import type { RouteMeta } from 'boltdocs'

export interface PathFilterOptions {
  /** Only process routes whose path starts with one of these prefixes. */
  paths?: string[]
  /** Skip routes whose path starts with one of these prefixes. */
  excludePaths?: string[]
}

function normalizePrefix(prefix: string): string {
  const trimmed = prefix.trim()
  if (!trimmed) return ''
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return withLeadingSlash.length > 1
    ? withLeadingSlash.replace(/\/+$/, '')
    : withLeadingSlash
}

function matchesPrefix(routePath: string, prefix: string): boolean {
  const normalized = normalizePrefix(prefix)
  if (!normalized) return false
  return routePath === normalized || routePath.startsWith(`${normalized}/`)
}

/** Applies the plugin `paths` / `excludePaths` options to a route path. */
export function matchesRoutePath(
  routePath: string,
  options: PathFilterOptions,
): boolean {
  if (options.paths && options.paths.length > 0) {
    if (!options.paths.some((prefix) => matchesPrefix(routePath, prefix))) {
      return false
    }
  }

  if (options.excludePaths && options.excludePaths.length > 0) {
    if (
      options.excludePaths.some((prefix) => matchesPrefix(routePath, prefix))
    ) {
      return false
    }
  }

  return true
}

/** Absolute source file for a route, falling back to the docs directory. */
export function routeFilePath(route: RouteMeta, docsDir: string): string {
  if (route.componentPath) return path.resolve(route.componentPath)
  return path.resolve(docsDir, route.filePath)
}
