import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

export interface ResolvedPluginPackage {
  name: string
  dir: string
  pkg: Record<string, unknown>
  version?: string
}

/**
 * Locates an installed plugin package and reads its package.json.
 *
 * IMPORTANT: this only resolves the file path of `package.json` and parses
 * its JSON. It never requires or imports the plugin's code, never runs its
 * scripts, and never executes anything from the package.
 */
export function resolvePluginPackage(
  name: string,
  root: string,
): ResolvedPluginPackage | null {
  let pkgPath: string | null = null

  try {
    const localRequire = createRequire(path.resolve(root, 'package.json'))
    pkgPath = localRequire.resolve(`${name}/package.json`)
  } catch {
    // fall through to the direct node_modules lookup below
  }

  if (!pkgPath) {
    const fallback = path.resolve(root, 'node_modules', name, 'package.json')
    if (fs.existsSync(fallback)) pkgPath = fallback
  }

  if (!pkgPath || !fs.existsSync(pkgPath)) return null

  let pkg: Record<string, unknown>
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as Record<
      string,
      unknown
    >
  } catch {
    return null
  }

  const dir = path.dirname(pkgPath)
  return {
    name,
    dir,
    pkg,
    version: typeof pkg.version === 'string' ? pkg.version : undefined,
  }
}
