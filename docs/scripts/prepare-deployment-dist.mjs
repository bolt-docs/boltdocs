import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  linkSync,
  copyFileSync,
  statSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'

const docsDir = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(docsDir, '..', 'dist')
const baseDir = path.join(distDir, 'docs')

mkdirSync(baseDir, { recursive: true })

const COMPRESSIBLE = new Set([
  '.html',
  '.js',
  '.mjs',
  '.css',
  '.json',
  '.xml',
  '.txt',
  '.svg',
  '.map',
  '.webmanifest',
])

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true })
}

function linkOrCopyFile(source, destination) {
  ensureDir(path.dirname(destination))
  if (existsSync(destination)) return false
  try {
    // Hardlink avoids duplicating bytes on disk while keeping both paths.
    linkSync(source, destination)
    return true
  } catch {
    copyFileSync(source, destination)
    return true
  }
}

function mirrorPath(source, destination) {
  const st = lstatSync(source)
  if (st.isDirectory()) {
    ensureDir(destination)
    for (const entry of readdirSync(source, { withFileTypes: true })) {
      mirrorPath(
        path.join(source, entry.name),
        path.join(destination, entry.name),
      )
    }
    return
  }
  if (st.isFile()) {
    linkOrCopyFile(source, destination)
  }
}

// Mirror root-level non-page entries (assets, images, schemas) under /docs so
// a base-prefixed deployment can serve them at /docs/<...> too.
//
// This must be ADD-ONLY: current build output at destination wins. Use
// hardlinks to avoid duplicating bytes on disk (same content, two paths).
for (const entry of readdirSync(distDir, { withFileTypes: true })) {
  if (entry.name === 'docs' || entry.name.endsWith('.html')) continue
  const source = path.join(distDir, entry.name)
  const destination = path.join(baseDir, entry.name)
  mirrorPath(source, destination)
}

function* walkFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walkFiles(full)
    else if (entry.isFile()) yield full
  }
}

function shouldCompress(file) {
  const ext = path.extname(file).toLowerCase()
  if (!COMPRESSIBLE.has(ext)) return false
  if (file.endsWith('.br') || file.endsWith('.gz')) return false
  try {
    return statSync(file).size >= 1024
  } catch {
    return false
  }
}

function compressBrotliIfMissing(file) {
  const out = `${file}.br`
  if (existsSync(out)) return false
  try {
    const input = readFileSync(file)
    const compressed = zlib.brotliCompressSync(input, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      },
    })
    // Only keep if it actually saves bytes.
    if (compressed.length < input.length) {
      writeFileSync(out, compressed)
      return true
    }
  } catch {
    // ignore compression failures for individual files
  }
  return false
}

function compressGzipIfMissing(file) {
  const out = `${file}.gz`
  if (existsSync(out)) return false
  try {
    const input = readFileSync(file)
    const compressed = zlib.gzipSync(input, { level: 9 })
    if (compressed.length < input.length) {
      writeFileSync(out, compressed)
      return true
    }
  } catch {
    // ignore compression failures for individual files
  }
  return false
}

let brCount = 0
let gzCount = 0
for (const file of walkFiles(distDir)) {
  if (!shouldCompress(file)) continue
  if (compressBrotliIfMissing(file)) brCount++
  if (compressGzipIfMissing(file)) gzCount++
}

// Register mirrored and precompressed files as post-build extras in the SSG
// output state so the ultra-warm fast path stays consistent.
const statePath = path.resolve(docsDir, '..', '.boltdocs/build/ssg-output.json')
try {
  const state = JSON.parse(readFileSync(statePath, 'utf8'))
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

console.log(
  `[docs] deployment assets mirrored under /docs (hardlinked where possible), precompressed: ${brCount} brotli, ${gzCount} gzip`,
)
