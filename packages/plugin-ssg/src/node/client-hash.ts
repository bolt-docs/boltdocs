import { warn } from '@bdocs/dui'
import fs from 'fs-extra'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { dirname, join, relative } from 'node:path'

/**
 * O(1) client code hash.
 *
 * Instead of recursively scanning ALL files in the docs directory and hashing
 * their content (O(N) with expensive reads), we use the Sätteri precompile
 * manifest as a content proxy.
 *
 * - **Fast path:** Sätteri manifest exists → hash the entire manifest file
 *   (SHA-256 of ~50 kB JSON).  The manifest already contains per-file content
 *   hashes for every MDX/MD file, plus a globalKey that captures compiler
 *   version, plugin changes, and config changes.  This is O(1).
 *
 * - **Fallback path (first build):** No manifest yet → lightweight stat-only
 *   scan of docs/ (mtime + size + relative path, NO content hashing).
 *   The first call is only used to check the client build cache (which won't
 *   be a hit on the first build anyway), so accuracy is less important.
 *   The second call (after client build) always has the manifest.
 *
 * - Config files + lock files are included in both paths (O(1) overhead).
 *
 * - Non-MDX assets in docs/ (CSS, JS, images) are checked via a lightweight
 *   targeted stat of well-known directories (docs/public/, docs/src/).
 */

/* ───────────── Sätteri manifest hash (fast path) ───────────── */

/**
 * Hash the entire Sätteri manifest file.  This captures EVERY MDX content
 * change (per-file contentHash changes) and every compiler/plugin/config
 * change (globalKey changes) in a single O(1) read.
 */
function hashSatteriManifest(
  manifestPath: string,
  hasher: ReturnType<typeof createHash>,
): boolean {
  try {
    if (!fs.existsSync(manifestPath)) return false
    const manifestBytes = fs.readFileSync(manifestPath)
    hasher.update(manifestBytes as Uint8Array)
    return true
  } catch {
    return false
  }
}

/* ───────────── Lightweight stat-only scan (fallback) ───────────── */

/** Directories to skip when scanning docs/ during fallback. */
const FALLBACK_IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.boltdocs',
  '.turbo',
  'dist',
  'coverage',
  '__tests__',
  'test',
  'tests',
  '.next',
  '.cache',
])

/** Client-relevant extensions for fallback stat scan. */
const FALLBACK_RELEVANT_EXTS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.css',
  '.json',
  '.md',
  '.mdx',
  '.html',
  '.svg',
  '.yaml',
  '.yml',
  '.webp',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
])

function isRelevantExt(filePath: string): boolean {
  const dot = filePath.lastIndexOf('.')
  if (dot === -1) return false
  const ext = filePath.slice(dot).toLowerCase()
  return FALLBACK_RELEVANT_EXTS.has(ext)
}

/**
 * Recursively stat files in a directory, updating the hasher with
 * `relativePath:mtime:size`.  Only stats — never reads file contents.
 * This is O(N) on the number of files but avoids expensive content hashing,
 * keeping it under ~50ms even for 10k files.
 */
function statFilesRecursive(
  dir: string,
  root: string,
  hasher: ReturnType<typeof createHash>,
): void {
  let entries: string[]
  try {
    entries = fs.readdirSync(dir)
  } catch {
    return
  }

  // Sort for deterministic order regardless of filesystem iteration
  entries.sort()

  for (const name of entries) {
    if (name.startsWith('.')) continue // skip hidden files/dirs
    const fullPath = join(dir, name)
    let stat: fs.Stats
    try {
      stat = fs.statSync(fullPath)
    } catch {
      continue
    }

    if (stat.isDirectory()) {
      if (FALLBACK_IGNORE_DIRS.has(name)) continue
      statFilesRecursive(fullPath, root, hasher)
    } else if (stat.isFile() && isRelevantExt(name)) {
      const relPath = relative(root, fullPath).replace(/\\/g, '/')
      hasher.update(`${relPath}:${stat.mtimeMs}:${stat.size}\n`)
    }
  }
}

/* ───────────── Framework code check ───────────── */

/**
 * Stat-scan the framework packages that ship the client bundle, virtual
 * modules, and SSG runtime. In a pnpm workspace these are symlinks into
 * `packages/*`, so `mtime:size` changes there — a core rebuild, a patched
 * plugin — must invalidate the docs client/SSR cache exactly like MDX or
 * config changes do. Stat-only, so the cost stays in the low milliseconds.
 * Published installs resolve to the immutable package tarball and are a no-op.
 */
function hashFrameworkCode(
  root: string,
  hasher: ReturnType<typeof createHash>,
): void {
  const require = createRequire(import.meta.url)
  // `boltdocs` is the primary framework package. `@bdocs/ssg` may not resolve
  // from the site root (pnpm nests it under boltdocs), but core's client dist
  // bundles the ssg client code, so hashing boltdocs covers it — the extra
  // spec is only a safety net for install layouts where it does resolve.
  const specs = ['boltdocs', '@bdocs/ssg']
  for (const spec of specs) {
    try {
      const packageDir = dirname(
        require.resolve(`${spec}/package.json`, { paths: [root] }),
      )
      const distDir = join(packageDir, 'dist')
      if (fs.existsSync(distDir)) {
        statFilesRecursive(distDir, root, hasher)
      }
    } catch {
      // Package not resolvable from this project — nothing to hash.
    }
  }
}

/* ───────────── Non-MDX asset check ───────────── */

/**
 * Lightweight check of non-MDX asset directories (docs/public/, docs/src/).
 * Only stats file existence + mtime — never hashes content.
 */
function hashNonMdxAssets(
  root: string,
  docsDirName: string,
  hasher: ReturnType<typeof createHash>,
): void {
  const assetDirs = [
    join(root, docsDirName, 'public'),
    join(root, docsDirName, 'src'),
  ]
  for (const dir of assetDirs) {
    try {
      if (fs.existsSync(dir)) {
        statFilesRecursive(dir, root, hasher)
      }
    } catch {
      // Non-critical
    }
  }
}

/* ───────────── Config files — already O(1) ───────────── */

const CONFIG_FILES = [
  'boltdocs.config.ts',
  'boltdocs.config.js',
  'boltdocs.config.mjs',
  'boltdocs.config.cjs',
  'package.json',
  'tsconfig.json',
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
]

function hashConfigFiles(
  root: string,
  hasher: ReturnType<typeof createHash>,
): void {
  for (const file of CONFIG_FILES) {
    const fullPath = join(root, file)
    try {
      if (fs.existsSync(fullPath)) {
        const stat = fs.statSync(fullPath)
        hasher.update(`${file}:${stat.mtimeMs}:${stat.size}\n`)
      }
    } catch {
      // File might have been deleted between existsSync and statSync
    }
  }
}

export function computeShellHash(root: string, docsDirName: string): string {
  try {
    const hasher = createHash('sha256')
    // Hash non-MDX asset files and config files only
    hashNonMdxAssets(root, docsDirName, hasher)
    hashConfigFiles(root, hasher)
    return hasher.digest('hex')
  } catch {
    return createHash('sha256').update('__shell_hash_fallback__').digest('hex')
  }
}

export function computeClientCodeHash(
  root: string,
  docsDirName: string,
  _cacheDir: string,
): string {
  // Clean up legacy Merkle cache file from pre implementation.
  // The Merkle cache was removed in favor of Sätteri manifest hash + stat-only
  // fallback.  This one-time cleanup prevents stale files from accumulating.
  try {
    fs.removeSync(join(_cacheDir, 'hash-merkle.json'))
  } catch {
    // Non-critical, ignore
  }

  try {
    const hasher = createHash('sha256')

    // ---- Framework code always participates in the hash ----
    hashFrameworkCode(root, hasher)

    // ---- Strategy 1: Sätteri manifest exists → O(1) manifest hash ----
    const manifestPath = join(root, '.boltdocs', 'compiled', 'manifest.json')
    const manifestHashed = hashSatteriManifest(manifestPath, hasher)

    if (!manifestHashed) {
      // ---- Strategy 2: First build, no manifest yet → lightweight stat ----
      const docsDir = join(root, docsDirName)
      if (fs.existsSync(docsDir)) {
        statFilesRecursive(docsDir, root, hasher)
      }
      // hashNonMdxAssets is intentionally skipped here because
      // statFilesRecursive already covers the entire docs/ directory
      // (including public/ and src/ subdirectories).
    } else {
      // ---- Warm build: manifest covers MDX content — also check non-MDX ----
      hashNonMdxAssets(root, docsDirName, hasher)
    }

    // ---- Always includes: config files + lock files ----
    hashConfigFiles(root, hasher)

    return hasher.digest('hex')
  } catch (e) {
    warn(
      `[client-hash] Failed to compute client code hash: ${e instanceof Error ? e.message : String(e)}`,
    )
    return createHash('sha256').update('__client_hash_error__').digest('hex')
  }
}
