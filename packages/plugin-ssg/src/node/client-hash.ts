import { warn } from '@bdocs/dui'
import fs from 'fs-extra'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { dirname, join, relative } from 'node:path'

/**
 * Content-based client code hash.
 *
 * Every input that can change the client bundle participates through the
 * **content** it contributes, never through stat metadata and never through
 * a derived artifact:
 *
 * - **Framework code** (`boltdocs` + `@bdocs/ssg` dist): SHA-1 of every file
 *   in the resolved package dist directories. In a pnpm workspace these are
 *   symlinks into `packages/*`, so a core rebuild invalidates the docs
 *   client/SSR cache exactly like an MDX edit does. Published installs
 *   resolve to the immutable package tarball and hash the same bytes forever.
 *
 * - **Everything under docs/** (MDX content, public/ assets, src/ overrides):
 *   one sorted content walk. This is deliberately read straight from the
 *   source files — NOT proxied through the Sätteri precompile manifest.
 *   The manifest is only updated during the client build, so hashing it made
 *   the client hash lag one build behind every content edit (edit in build N
 *   → hash changes in N+1 → spurious client rebuild + full re-render). Page
 *   MDX text does flow into the client bundle (route chunks + search index),
 *   so it must invalidate — but synchronously, from the bytes themselves.
 *
 * - **Config**: `boltdocs.config.*`, `package.json`, `tsconfig.json` content.
 *   Lockfiles are deliberately excluded — a lockfile-only refresh (mtime
 *   churn from `pnpm install --lockfile-only`, or a checkout that touches
 *   them) does not change what Vite bundles.
 *
 * All paths hash `relativePath\0sha1(content)` pairs in sorted order so the
 * result is stable across checkouts that rewrite mtimes, and across
 * filesystems that reorder directory iteration. Cost is a few MB of reads
 * (docs + dists) — tens of milliseconds, twice per build.
 */

/**
 * Format version for the client hash derivation itself. Bump whenever the
 * set of hashed inputs or their encoding changes: entries stored under the
 * old format (client cache dirs keyed by the old digest) miss once and get
 * rebuilt — never false-positive.
 */
const CLIENT_HASH_VERSION = 'v4\0'

/** Directories never hashed: build outputs and dependency trees. */
const IGNORED_DIRS = new Set(['node_modules', 'dist', 'coverage'])

/** Directory separators normalized in relative-path labels. */
function relLabel(root: string, fullPath: string): string {
  return relative(root, fullPath).replace(/\\/g, '/')
}

/**
 * Hash one file's content into the stream as `relPath\0sha1(bytes)`.
 * Content hashing (not stat) is what makes the hash stable across mtimes.
 */
function hashFileContent(
  root: string,
  fullPath: string,
  hasher: ReturnType<typeof createHash>,
): void {
  try {
    const content = fs.readFileSync(fullPath)
    // Copy into a plain Uint8Array: this project's @types/node rejects
    // `Buffer` as `crypto.BinaryLike` (SharedArrayBuffer variance).
    const bytes = new Uint8Array(
      content.buffer.slice(
        content.byteOffset,
        content.byteOffset + content.byteLength,
      ),
    )
    const digest = createHash('sha1').update(bytes).digest('hex')
    hasher.update(`${relLabel(root, fullPath)}\0${digest}\0`)
  } catch {
    // File removed between readdir and read — skip; the next build re-hashes.
  }
}

/**
 * Recursively hash every file's content in a directory, in sorted order.
 * Hidden entries (dot-prefixed) and build-output/dependency directories are
 * skipped, which keeps `.boltdocs` caches out of the hash.
 */
function hashDirectoryContent(
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

  // Sort for deterministic order regardless of filesystem iteration.
  entries.sort()

  for (const name of entries) {
    if (name.startsWith('.')) continue // skip hidden files/dirs
    if (IGNORED_DIRS.has(name)) continue
    const fullPath = join(dir, name)
    let stat: fs.Stats
    try {
      stat = fs.statSync(fullPath)
    } catch {
      continue
    }
    if (stat.isDirectory()) {
      hashDirectoryContent(fullPath, root, hasher)
    } else if (stat.isFile()) {
      hashFileContent(root, fullPath, hasher)
    }
  }
}

/* ───────────── Framework code check ───────────── */

/**
 * Content-hash the dist directories of the framework packages that ship the
 * client bundle, virtual modules, and SSG runtime. Hashing **all** files —
 * including `.mjs`/`.cjs` bundles — is essential: an earlier stat-only pass
 * only matched extensions like `.js` and silently ignored the `.mjs` chunks
 * tsdown emits, so a core rebuild could go unnoticed by the client cache.
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
        hashDirectoryContent(distDir, root, hasher)
      }
    } catch {
      // Package not resolvable from this project — nothing to hash.
    }
  }
}

/* ───────────── Config files ───────────── */

/**
 * Config files whose **content** changes what Vite bundles. Lockfiles are
 * intentionally excluded: their bytes do not enter the bundle, and their
 * mtimes churn on checkout/lockfile-only installs.
 */
const CONFIG_FILES = [
  'boltdocs.config.ts',
  'boltdocs.config.js',
  'boltdocs.config.mjs',
  'boltdocs.config.cjs',
  'package.json',
  'tsconfig.json',
]

function hashConfigFiles(
  root: string,
  hasher: ReturnType<typeof createHash>,
): void {
  for (const file of CONFIG_FILES) {
    const fullPath = join(root, file)
    if (fs.existsSync(fullPath)) {
      hashFileContent(root, fullPath, hasher)
    }
  }
}

/* ───────────── Public API ───────────── */

export function computeShellHash(root: string, docsDirName: string): string {
  try {
    const hasher = createHash('sha256')
    // Hash non-MDX asset files and config files only
    const assetDirs = [
      join(root, docsDirName, 'public'),
      join(root, docsDirName, 'src'),
    ]
    for (const dir of assetDirs) {
      if (fs.existsSync(dir)) hashDirectoryContent(dir, root, hasher)
    }
    hashConfigFiles(root, hasher)
    hasher.update(CLIENT_HASH_VERSION)
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
  // The Merkle cache was removed in favor of direct content scans.
  // This one-time cleanup prevents stale files from accumulating.
  try {
    fs.removeSync(join(_cacheDir, 'hash-merkle.json'))
  } catch {
    // Non-critical, ignore
  }

  try {
    const hasher = createHash('sha256')

    // ---- Framework code always participates in the hash ----
    hashFrameworkCode(root, hasher)

    // ---- All of docs/ from the source bytes (no artifact proxies) ----
    // One walk covers MDX content, public assets, and src overrides. Reading
    // the files directly (instead of the Sätteri manifest) is what keeps the
    // hash free of build-order lag: the manifest only updates during the
    // client build, so it always described the *previous* state.
    const docsDir = join(root, docsDirName)
    if (fs.existsSync(docsDir)) {
      hashDirectoryContent(docsDir, root, hasher)
    }

    // ---- Site client-code overrides (src/) ----
    // Layout, theme components, hooks and styles live under the site's `src/`
    // directory and are bundled by Vite exactly like framework dist. They must
    // participate in the hash or a theme-only edit leaves both the client
    // build AND every cached page stale.
    const srcDir = join(root, 'src')
    if (fs.existsSync(srcDir)) {
      hashDirectoryContent(srcDir, root, hasher)
    }

    // ---- Always includes: config + tsconfig (content) ----
    hashConfigFiles(root, hasher)

    // ---- Format version: old-format cache entries miss safely ----
    hasher.update(CLIENT_HASH_VERSION)

    return hasher.digest('hex')
  } catch (e) {
    warn(
      `[client-hash] Failed to compute client code hash: ${e instanceof Error ? e.message : String(e)}`,
    )
    return createHash('sha256').update('__client_hash_error__').digest('hex')
  }
}
