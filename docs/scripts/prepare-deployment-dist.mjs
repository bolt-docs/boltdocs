import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const docsDir = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(docsDir, '..', 'dist')
const baseDir = path.join(distDir, 'docs')

mkdirSync(baseDir, { recursive: true })

// Mirror root-level non-page entries (assets, images, schemas) under /docs so
// a base-prefixed deployment can serve them at /docs/<...> too.
//
// This must be ADD-ONLY: a build of this site may have just written real
// pages there (e.g. the /es locale tree). Deleting the destination first —
// the previous behavior — destroyed freshly built pages whenever a stale
// root-level leftover shared the name, and the resulting extra/missing files
// also desynced the SSG output-state check that enables the ultra-warm fast
// path. The build itself already resets dist/, so anything at the
// destination is current build output and always wins over the mirror.
for (const entry of readdirSync(distDir, { withFileTypes: true })) {
  if (entry.name === 'docs' || entry.name.endsWith('.html')) continue

  const source = path.join(distDir, entry.name)
  const destination = path.join(baseDir, entry.name)

  if (existsSync(destination)) continue
  cpSync(source, destination, { recursive: true })
}

// Register the mirrored files as post-build extras in the SSG output state,
// so the next build's ultra-warm fast path knows the dist is still exactly
// what the pipeline produced plus these add-only mirrors. Without this, the
// extra files fail the state's strict listing check and every build pays for
// a full reset-and-restore pass.
const statePath = path.resolve(docsDir, '..', '.boltdocs/build/ssg-output.json')
try {
  const state = JSON.parse(readFileSync(statePath, 'utf8'))
  // Deliberately NOT subtracting a previous extraFiles list: this recomputes
  // extras from scratch each run (dist listing minus build-owned files), so
  // repeated runs converge instead of wiping previously registered extras.
  const owned = new Set([
    ...(state.clientFiles ?? []),
    ...(state.pageFiles ?? []),
    ...(state.auxiliaryFiles ?? []),
  ])
  const listed = []
  const visit = (dir, prefix) => {
    for (const it of readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${it.name}` : it.name
      if (it.isDirectory()) visit(path.join(dir, it.name), rel)
      else if (it.isFile()) listed.push(rel)
    }
  }
  visit(distDir, '')
  state.extraFiles = listed.filter((f) => !owned.has(f)).sort()
  writeFileSync(statePath, JSON.stringify(state, null, 2))
} catch {
  // No state (first build or cache cleared): nothing to register.
}

console.log('[docs] deployment assets mirrored under /docs')
