import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import type { BoltdocsConfig } from '../shared/types'

/**
 * The theme a site gets when it does not ask for one.
 *
 * A default, not a dependency: the engine resolves this package from the
 * project at build time and imports the route surface from it. A site that
 * installs a different theme names it in `themePackage`, and the engine never
 * learns what a theme looks like.
 */
export const DEFAULT_THEME_PACKAGE = '@bdocs/theme-neutral'

/**
 * The theme package the project asked for.
 *
 * The engine has no opinion about which theme that is. It reads the name from
 * the configuration and resolves it from the project, so a second theme is a
 * second package rather than a fork of the engine.
 */
export function resolveThemePackage(
  config?: Pick<BoltdocsConfig, 'themePackage'>,
): string {
  const requested = config?.themePackage?.trim()
  return requested || DEFAULT_THEME_PACKAGE
}

/**
 * The installed theme package's root directory, or undefined.
 *
 * Walks up from the project root looking in `node_modules`, which is how a
 * workspace link and a published install both look on disk: pnpm symlinks the
 * package directory into the project's `node_modules`, and npm does the same
 * for a registry install.
 */
export function findInstalledThemeRoot(
  packageName: string,
  root: string,
): string | undefined {
  let dir = path.resolve(root)
  while (true) {
    const candidate = path.join(dir, 'node_modules', packageName)
    if (fs.existsSync(path.join(candidate, 'package.json'))) {
      return candidate
    }
    const parent = path.dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
}

/**
 * Whether the theme package is installed in the project.
 *
 * Resolved from the project root rather than from the engine's own
 * dependencies: a theme the site did not install is a missing dependency, and
 * the error has to say so instead of failing later with a module-not-found
 * from inside a virtual module.
 */
export function isThemePackageInstalled(
  packageName: string,
  root: string,
): boolean {
  if (findInstalledThemeRoot(packageName, root)) return true
  try {
    const require = createRequire(path.join(root, 'package.json'))
    require.resolve(`${packageName}/package.json`)
    return true
  } catch {
    // Not every package exposes `./package.json` through its export map, so
    // fall back to resolving the entry point itself.
    try {
      const require = createRequire(path.join(root, 'package.json'))
      require.resolve(packageName)
      return true
    } catch {
      return false
    }
  }
}

/**
 * The theme's source entry, when the installed package ships one.
 *
 * A theme installed from the registry has no `src/`, and the built entry is
 * the right one. A theme checked out next to the project — a workspace link in
 * a monorepo — has one, and using it means an edit to a theme component is
 * picked up without rebuilding the package first.
 */
export function resolveThemeSourceEntry(
  packageName: string,
  root: string,
): string | undefined {
  const packageRoot = findInstalledThemeRoot(packageName, root)
  if (!packageRoot) return undefined
  const source = path.join(packageRoot, 'src', 'index.ts')
  return fs.existsSync(source) ? source : undefined
}
