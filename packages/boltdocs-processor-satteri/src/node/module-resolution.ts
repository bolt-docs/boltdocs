import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve as resolvePath } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

/**
 * Resolve a module the way the *site* resolves it.
 *
 * A hook names a module the site depends on — a published plugin. The worker
 * is not the site: it lives in the framework's own package, where the site's
 * dependencies are not installed. So the module is resolved from the project
 * root, the way the site's own code would resolve it.
 *
 * `require.resolve` is not enough. A package whose entry points are only
 * declared in `exports` — which is every published plugin here — has no `main`
 * for it to find, and it refuses to resolve `./package.json` because the
 * package does not export it. The `exports` map is therefore read directly.
 */
export function resolveProjectModule(
  projectRoot: string,
  moduleName: string,
): string {
  const requireFromProject = createRequire(join(projectRoot, 'package.json'))

  // A path relative to the project, or an absolute path.
  if (moduleName.startsWith('.') || moduleName.startsWith('/')) {
    return resolvePath(projectRoot, moduleName)
  }

  // A package with a `main` resolves directly.
  try {
    return requireFromProject.resolve(moduleName)
  } catch {
    // Fall through: the package declares its entry points in `exports`.
  }

  // Find the package's directory the way Node does, then read its `exports`.
  const packageJsonPath = findPackageJson(projectRoot, moduleName)
  if (!packageJsonPath) {
    throw new Error(`Cannot resolve module "${moduleName}" from ${projectRoot}`)
  }

  const manifest = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as {
    exports?: unknown
    main?: string
  }

  const entry = resolveExportEntry(manifest.exports, moduleName)
  if (entry) {
    return resolvePath(dirname(packageJsonPath), entry)
  }

  if (manifest.main) {
    return resolvePath(dirname(packageJsonPath), manifest.main)
  }

  throw new Error(
    `Module "${moduleName}" has no resolvable entry point (its package.json declares neither "main" nor an "exports" entry for it)`,
  )
}

/**
 * Walk up from the project root looking for the package's `package.json`.
 */
function findPackageJson(
  projectRoot: string,
  moduleName: string,
): string | null {
  const parts = moduleName.split('/')
  const packageName = moduleName.startsWith('@')
    ? parts.slice(0, 2).join('/')
    : parts[0]

  let dir = projectRoot
  for (;;) {
    const candidate = join(dir, 'node_modules', packageName, 'package.json')
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

/**
 * Read the entry point of a subpath out of an `exports` map.
 *
 * The map is either a string (the whole package), or an object whose keys
 * are either the subpaths or the conditions. The conditions are tried in the
 * order Node tries them.
 *
 * The package root is the `"."` subpath — `@scope/name` resolves through it,
 * while `@scope/name/sub` resolves through `"./sub"`.
 */
function resolveExportEntry(
  exports: unknown,
  moduleName: string,
): string | null {
  if (typeof exports === 'string') return exports
  if (!exports || typeof exports !== 'object') return null

  const map = exports as Record<string, unknown>

  // A subpath map: `{'./package.json': './package.json', '.': {...}}`.
  const subpathKeys = Object.keys(map).filter((key) => key.startsWith('.'))
  if (subpathKeys.length > 0) {
    // The part of the module name after the package name.
    const parts = moduleName.split('/')
    const packageParts = moduleName.startsWith('@') ? 2 : 1
    const subpath = parts.slice(packageParts).join('/')
    const wanted = subpath ? `./${subpath}` : '.'

    const key = subpathKeys.find((candidate) => candidate === wanted)
    if (!key) return null

    const value = map[key]
    if (typeof value === 'string') return value
    if (value && typeof value === 'object') {
      return resolveConditions(value as Record<string, unknown>)
    }
    return null
  }

  // A conditions map for the package root.
  return resolveConditions(map)
}

/** Read the first matching condition out of a conditions map. */
function resolveConditions(conditions: Record<string, unknown>): string | null {
  for (const condition of ['import', 'node', 'default']) {
    const value = conditions[condition]
    if (typeof value === 'string') return value
    if (value && typeof value === 'object') {
      const nested = resolveConditions(value as Record<string, unknown>)
      if (nested) return nested
    }
  }
  return null
}

/** Import a module by an absolute path. */
export function importFromPath(absolutePath: string): Promise<unknown> {
  return import(pathToFileURL(absolutePath).href)
}
