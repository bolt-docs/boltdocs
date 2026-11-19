/**
 * Publishability guard.
 *
 * `workspace:*` is rewritten to a concrete version when a package is packed,
 * but the target still has to exist on npm. A published package that points at
 * a private workspace package produces an install that can never resolve.
 *
 * Run with `pnpm check:publishable`.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const PACKAGES_DIR = path.join(ROOT, 'packages')
const FIELDS = ['dependencies', 'optionalDependencies', 'peerDependencies']

const manifests = new Map()
for (const dir of fs.readdirSync(PACKAGES_DIR)) {
  const file = path.join(PACKAGES_DIR, dir, 'package.json')
  if (!fs.existsSync(file)) continue
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'))
  manifests.set(manifest.name, { manifest, dir })
}

const problems = []
for (const [name, { manifest, dir }] of manifests) {
  if (manifest.private) continue
  for (const field of FIELDS) {
    for (const [dep, spec] of Object.entries(manifest[field] ?? {})) {
      if (spec !== 'workspace:*') continue
      const target = manifests.get(dep)
      if (!target) {
        problems.push(`${name} (${field}) → ${dep}: not in this workspace`)
      } else if (target.manifest.private) {
        problems.push(`${name} (${field}) → ${dep}: target is private`)
      }
    }
  }
}

if (problems.length > 0) {
  console.error('[publishable] Unresolvable workspace dependencies:')
  for (const problem of problems) console.error(`  - ${problem}`)
  console.error(
    '\nMake the target publishable (remove "private": true, add publishConfig)\n' +
      'or move the dependency to devDependencies / make it optional with a\n' +
      'runtime fallback before publishing.',
  )
  process.exit(1)
}

console.log(
  `[publishable] OK — ${manifests.size} packages checked, no private or missing workspace targets`,
)
