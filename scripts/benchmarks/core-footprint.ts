/**
 * SPEC §6 rule 1 — production footprint of the core.
 *
 * Bloat is measured on shipped bytes, not source: the gzipped size of the
 * `boltdocs` entry, the number of bare imports it resolves, and the total
 * gzipped bytes the engine contributes. Run after every change that touches
 * the core and compare against the committed baseline.
 */

import fs from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', '..')
const ENGINE_DIST = path.join(ROOT, 'packages', 'boltdocs', 'dist')
const BASELINE = path.join(__dirname, 'core-footprint-baseline.json')

interface Footprint {
  createdAt: string
  entryGzipBytes: number
  totalGzipBytes: number
  runtimeImports: string[]
  files: number
}

function gzip(file: string): number {
  return gzipSync(fs.readFileSync(file), { level: 9 }).byteLength
}

function bareImports(source: string): string[] {
  const names = new Set<string>()
  const re = /(?:from|import)\s*['"]([^'"]+)['"]/g
  for (const match of source.matchAll(re)) {
    const spec = match[1]
    if (!spec || spec.startsWith('.') || spec.startsWith('node:')) continue
    names.add(
      spec.startsWith('@')
        ? spec.split('/').slice(0, 2).join('/')
        : spec.split('/')[0],
    )
  }
  return [...names].sort()
}

function measure(): Footprint {
  if (!fs.existsSync(ENGINE_DIST)) {
    throw new Error(
      `Engine dist not found at ${ENGINE_DIST}; run pnpm build first.`,
    )
  }
  const files = fs
    .readdirSync(ENGINE_DIST)
    .filter((f) => f.endsWith('.mjs'))
    .map((f) => path.join(ENGINE_DIST, f))
  const source = fs.readFileSync(
    path.join(ENGINE_DIST, 'node', 'index.mjs'),
    'utf8',
  )
  return {
    createdAt: new Date().toISOString(),
    entryGzipBytes: gzip(path.join(ENGINE_DIST, 'node', 'index.mjs')),
    totalGzipBytes: files.reduce((sum, file) => sum + gzip(file), 0),
    runtimeImports: bareImports(source),
    files: files.length,
  }
}

const current = measure()
console.log('[core-footprint]')
console.log(`  entry gzip      : ${current.entryGzipBytes} B`)
console.log(
  `  total gzip      : ${current.totalGzipBytes} B (${current.files} files)`,
)
console.log(
  `  runtime imports : ${current.runtimeImports.join(', ') || 'none'}`,
)

if (fs.existsSync(BASELINE)) {
  const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8')) as Footprint
  const delta = current.totalGzipBytes - baseline.totalGzipBytes
  console.log(
    `  vs baseline     : ${delta >= 0 ? '+' : ''}${delta} B ` +
      `(baseline ${baseline.totalGzipBytes} B)`,
  )
  if (delta > 0) {
    console.error(
      '[core-footprint] REJECTED: core production footprint grew without a removal (SPEC §6.1).',
    )
    process.exit(1)
  }
} else {
  fs.writeFileSync(BASELINE, `${JSON.stringify(current, null, 2)}\n`)
  console.log(`  baseline written: ${path.relative(ROOT, BASELINE)}`)
}
