import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

let cached: string | undefined

/**
 * Version of the running engine, found by walking up from the bundled module.
 * A relative `createRequire('../../../../package.json')` breaks when tsdown
 * splits the audit code into a separate chunk, so resolve by package name.
 */
export function getEngineVersion(): string {
  if (cached) return cached
  let dir = path.dirname(fileURLToPath(import.meta.url))
  for (let depth = 0; depth < 8; depth += 1) {
    const candidate = path.join(dir, 'package.json')
    if (fs.existsSync(candidate)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(candidate, 'utf8')) as {
          name?: string
          version?: string
        }
        if (pkg.name === 'boltdocs' && pkg.version) {
          cached = pkg.version
          return cached
        }
      } catch {
        // Keep walking; an unreadable manifest is not the engine's.
      }
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return '0.0.0'
}
