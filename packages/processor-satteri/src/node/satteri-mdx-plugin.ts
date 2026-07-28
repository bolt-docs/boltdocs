import type { Plugin, ResolvedConfig } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type { BoltdocsConfig, IPluginLifecycleManager } from 'boltdocs'
import {
  createSatteriProcessorPlugin,
  isPrecompileStarted,
  getPrecompilePromise,
  CompilePool,
} from './index'
import { collectUserPlugins } from './user-plugins'
import { MdxCompiler, MDX_PLUGIN_VERSION } from './compiler'
import type { PoolMetrics } from './compile-pool'

const PRE_COMPILED_CACHE = new Map<string, string>()
const _precompiledIds = new Set<string>()

/**
 * PR-03: Lazy-load cache — stores manifest entries (outFile path, export name)
 * instead of reading every cached file into memory at precompile time.
 * Files are read on-demand when Vite's `load()` hook actually requests them.
 */
const MANIFEST_CACHE = new Map<
  string,
  { outFile: string; exportName: string }
>()

/** Tracks the globalKey from the last precompile to avoid clearing cache on same-key builds. */
let LAST_GLOBAL_KEY = ''

/** Flag indicating whether precompile completed within this process. Prevents running twice on client + SSR builds. */
let _precompileCompleted = false
let _activePrecompilePromise: Promise<void> | null = null

export function resetPrecompileCompleted(): void {
  _precompileCompleted = false
  _activePrecompilePromise = null
}

interface PrecompileManifest {
  /** Version of the cache format. Bump when structure changes. */
  version: number
  /** Hash of everything that can change the compiled output except file content. */
  globalKey: string
  /** Per-file entries keyed by absolute file path. */
  files: Record<
    string,
    {
      contentHash: string
      exportName: string
      outFile: string
      mtime: number
    }
  >
}

const MANIFEST_VERSION = 1
const COMPILED_DIR_NAME = '.boltdocs'

function getCompileDir(root: string): string {
  return path.join(root, COMPILED_DIR_NAME, 'compiled')
}

function getManifestPath(root: string): string {
  return path.join(getCompileDir(root), 'manifest.json')
}

function hashInput(input: string | Buffer): string {
  return crypto.createHash('md5').update(input).digest('hex')
}

function readManifest(
  root: string,
  expectedGlobalKey: string,
): PrecompileManifest['files'] | null {
  try {
    const raw = fs.readFileSync(getManifestPath(root), 'utf-8')
    const manifest = JSON.parse(raw) as PrecompileManifest
    if (
      manifest.version !== MANIFEST_VERSION ||
      manifest.globalKey !== expectedGlobalKey
    ) {
      return null
    }
    return manifest.files || null
  } catch {
    return null
  }
}

function writeManifest(
  root: string,
  globalKey: string,
  files: PrecompileManifest['files'],
): void {
  try {
    const manifest: PrecompileManifest = {
      version: MANIFEST_VERSION,
      globalKey,
      files,
    }
    const manifestPath = getManifestPath(root)
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true })
    const tmp = `${manifestPath}.${hashInput(crypto.randomBytes(8).toString('hex'))}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(manifest), 'utf-8')
    fs.renameSync(tmp, manifestPath)
  } catch {
    // Manifest write failure is non-fatal
  }
}

/** Hash of everything that can change the compiled output aside from file content. */
function computeGlobalKey(
  compiler: MdxCompiler,
  config: BoltdocsConfig,
  hasTransformSource: boolean,
): string {
  // Include everything that can change the compiled output aside from file
  // content. We can't hash plugin functions, so we use names/versions when
  // available and fall back to counts.
  const pluginSignatures = (config.plugins || [])
    .map((p: any) => `${p?.name ?? 'unknown'}@${p?.version ?? '0'}`)
    .join(',')

  const parts = [
    `v${MANIFEST_VERSION}`,
    MDX_PLUGIN_VERSION,
    process.env.NODE_ENV || 'development',
    hasTransformSource ? 'with-transformSource' : 'no-transformSource',
    config.base || '',
    config.siteUrl || '',
    pluginSignatures,
    JSON.stringify(config.theme?.codeTheme || {}),
  ]
  return hashInput(parts.join('|'))
}

/** Path to the compiled pages index file (written after pre-compile for entry code to use). */
export let COMPILED_PAGES_INDEX_PATH: string | null = null
export let COMPILED_PAGES_MAP: Record<string, string> = {}
export const MDX_GLOB_MAP = new Map<string, string>()

function isMdx(id: string): boolean {
  const [cleanId] = id.split('?')
  return cleanId.endsWith('.md') || cleanId.endsWith('.mdx')
}

function looksCompiled(code: string): boolean {
  return (
    code.includes('function _createMdxContent') ||
    code.includes('react/jsx-runtime') ||
    code.includes('export default function MDXContent')
  )
}

/** Directories to skip when scanning for MDX files (prevents scanning node_modules). */
const IGNORE_SCAN_DIRS = new Set([
  'node_modules',
  '.git',
  '.boltdocs',
  'dist',
  'coverage',
  'public',
  'packages',
  '.turbo',
  '.next',
  '.cache',
])

/**
 * Recursively find all .md and .mdx files in a directory.
 * Skips hidden directories and common non-content directories (node_modules, etc.).
 */
function findMdxFiles(dir: string): string[] {
  const files: string[] = []
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && !IGNORE_SCAN_DIRS.has(entry.name)) {
          files.push(...findMdxFiles(fullPath))
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        if (ext === '.md' || ext === '.mdx') {
          files.push(fullPath)
        }
      }
    }
  } catch {}
  return files
}

/**
 * Parse an import line into structured parts and merge into the accumulator Map.
 * Handles:
 *   import defaultExport from 'source'
 *   import { named1, named2 } from 'source'
 *   import * as namespace from 'source'
 *   import defaultExport, { named1 } from 'source'
 *   import defaultExport, * as namespace from 'source'
 *
 * Named exports from the same source are merged into a single Set.
 * Conflicting default/star imports from the same source use the last seen value.
 */
function mergeImportLine(
  acc: Map<
    string,
    { defaultName: string | null; named: Set<string>; star: string | null }
  >,
  line: string,
): void {
  const trimmed = line.trim()
  if (!trimmed.startsWith('import ')) return

  // Extract the source module (between 'from' quotes)
  const fromMatch = trimmed.match(/from\s+['"]([^'"]+)['"]/)
  if (!fromMatch) return
  const source = fromMatch[1]

  // Get or create entry for this source
  let entry = acc.get(source)
  if (!entry) {
    entry = { defaultName: null, named: new Set(), star: null }
    acc.set(source, entry)
  }

  // Extract the part between 'import' and 'from'
  const between = trimmed.slice('import '.length, trimmed.indexOf(' from '))

  // Check for star import: import * as X from 'Y'
  const starMatch = between.match(/\*\s+as\s+(\w+)/)
  if (starMatch) {
    entry.star = starMatch[1]
  }

  // Check for named imports: { X, Y as Z }
  const namedMatch = between.match(/\{([^}]*)\}/)
  if (namedMatch) {
    const names = namedMatch[1]
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean)
    for (const name of names) {
      entry.named.add(name)
    }
  }

  // Check for default import: the part before any comma or { or *
  const defaultCandidate = between
    .replace(/,\s*\{.*$/, '')
    .replace(/,\s*\*.*$/, '')
    .trim()
  if (
    defaultCandidate &&
    !defaultCandidate.startsWith('{') &&
    !defaultCandidate.startsWith('*')
  ) {
    entry.defaultName = defaultCandidate
  }
}

/**
 * Generate a deterministic export name from a file path.
 */
function filePathToExportName(filePath: string): string {
  const hash = crypto
    .createHash('md5')
    .update(filePath)
    .digest('hex')
    .substring(0, 8)
  return `_p_${hash}`
}

export function createSatteriMdxPlugin(
  config: BoltdocsConfig,
  getLifecycle: () => IPluginLifecycleManager | undefined,
  pluginOptions?: { docsDir?: string },
): Plugin {
  const processor = createSatteriProcessorPlugin()
  const mdastPlugins = processor.mdastPlugins ?? []
  const hastPlugins = processor.hastPlugins ?? []

  // P2-22: Check if user plugins are present.  When false, we can use the
  // compile pool (workers have built-in plugins only).  When true, we must
  // compile on the main thread with the compiler instance.
  const userPlugins = collectUserPlugins(config)
  const hasUserPlugins =
    userPlugins.remarkPlugins.length > 0 || userPlugins.rehypePlugins.length > 0

  const compiler = new MdxCompiler(
    [...mdastPlugins, ...userPlugins.remarkPlugins],
    [...hastPlugins, ...userPlugins.rehypePlugins],
  )

  // P2-22: Compile pool for parallel MDX compilation
  // Only created when no user plugins are present (workers use built-in only)
  let compilePool: CompilePool | null = null
  let poolMetrics: PoolMetrics | null = null

  // Only run lifecycle chains when a plugin actually registered the hook.
  // `hasHook` is cheap; call it each time so we don't cache a false negative
  // before the lifecycle manager has finished initializing.
  function shouldRunTransformSource() {
    const lifecycle = getLifecycle?.()
    if (!lifecycle) return false
    if (typeof lifecycle.hasHook === 'function') {
      return lifecycle.hasHook('transformSource')
    }
    // Fallback for consumers that expose runChain but not hasHook.
    return typeof lifecycle.runChain === 'function'
  }

  function shouldRunTransformMdx() {
    const lifecycle = getLifecycle?.()
    if (!lifecycle) return false
    if (typeof lifecycle.hasHook === 'function') {
      return lifecycle.hasHook('transformMdx')
    }
    return typeof lifecycle.runChain === 'function'
  }

  let viteResolvedConfig: ResolvedConfig | undefined
  // Background pre-compilation promise kicked off in configResolved so it
  // can overlap with Vite's setup and the main boltdocs config() work.
  let preCompilePromise: Promise<void> | null = null

  /**
   * Perform the actual pre-compilation of all MDX files and write the
   * compiled pages to disk. This is shared between configResolved and
   * buildStart so the work can start early and finish by buildStart.
   */
  async function runPreCompile() {
    if (
      _precompileCompleted &&
      COMPILED_PAGES_INDEX_PATH &&
      fs.existsSync(COMPILED_PAGES_INDEX_PATH)
    ) {
      return
    }
    if (_activePrecompilePromise) {
      return _activePrecompilePromise
    }

    _activePrecompilePromise = (async () => {
      try {
        await _executePreCompile()
        _precompileCompleted = true
      } finally {
        _activePrecompilePromise = null
      }
    })()

    return _activePrecompilePromise
  }

  async function _executePreCompile() {
    const root = viteResolvedConfig?.root || process.cwd()
    const docsDirName = pluginOptions?.docsDir || 'docs'
    const docsDir = path.join(root, docsDirName)

    if (!fs.existsSync(docsDir)) return

    const mdxFiles = findMdxFiles(docsDir)
    if (mdxFiles.length === 0) return

    const startTime = performance.now()
    const compileDir = getCompileDir(root)
    const pagesDir = path.join(compileDir, 'pages')
    const pagesIndexFile = path.join(pagesDir, 'index.mjs')
    const globMapFile = path.join(compileDir, 'pages-glob-map.json')

    // If a plugin mutates source via transformSource, we cannot trust a
    // raw-file content hash. Disable cache hits for this run.
    const hasTransformSource = shouldRunTransformSource()

    // Global key changes whenever the compiler, plugins, or relevant env changes.
    const globalKey = computeGlobalKey(compiler, config, hasTransformSource)
    LAST_GLOBAL_KEY = globalKey
    const manifest = readManifest(root, globalKey) || {}

    // PR-03: Don't pre-populate PRE_COMPILED_CACHE from disk. Instead, store
    // manifest entries in MANIFEST_CACHE for lazy-loading on demand.  This
    // avoids reading 202+ cached output files sequentially (~1s) when most
    // won't be requested by Vite's load() hook.
    for (const file of mdxFiles) {
      const entry = manifest[file]
      if (entry && fs.existsSync(entry.outFile)) {
        MANIFEST_CACHE.set(file, {
          outFile: entry.outFile,
          exportName: entry.exportName,
        })
      }
    }

    // Fast path: when no transformSource hooks are active and all files are
    // in MANIFEST_CACHE, skip the per-file validation entirely.
    // When transformSource IS active, we must validate each file individually
    // because the same raw source may produce different compiled output if
    // the transform plugin changed.
    if (!hasTransformSource && fs.existsSync(pagesIndexFile)) {
      const allCached = mdxFiles.every((f) => MANIFEST_CACHE.has(f))
      if (allCached) {
        COMPILED_PAGES_INDEX_PATH = pagesIndexFile
        return
      }
    }

    let hitCount = 0
    let missCount = 0

    // P2-22: Create compile pool lazily — only when we know there are actual
    // cache misses AND no user plugins (workers have built-in plugins only).
    // Workers initialize in the background while the main thread starts
    // scanning files, so the pool may not be ready for the first few
    // compile requests — messages are queued by worker_threads automatically.
    if (!hasUserPlugins) {
      const optimalWorkers = Math.min(
        os.cpus().length || 4,
        Math.max(2, Math.ceil(mdxFiles.length / 25)),
      )
      compilePool = new CompilePool(optimalWorkers)
      compilePool.start().catch(() => {
        compilePool = null
      })
    }

    // Pre-compile only files that are not cached, with controlled concurrency.
    const concurrency = Math.min(mdxFiles.length, 16)
    let index = 0

    // Buffer raw content while we walk files to avoid re-reading during the
    // write phase. We read each file at most once per runPreCompile.
    const rawContentMap = new Map<string, string>()

    async function worker() {
      while (index < mdxFiles.length) {
        const file = mdxFiles[index++]

        // Fast path: when no transformSource is active and the file is in
        // PRE_COMPILED_CACHE (loaded earlier this process) or MANIFEST_CACHE
        // (lazy-loaded on-demand from the manifest), skip it entirely.
        // PR-03: Avoid reading cached file content into memory here — the
        // load() hook will lazy-load via MANIFEST_CACHE if needed.
        if (
          !hasTransformSource &&
          (PRE_COMPILED_CACHE.has(file) || MANIFEST_CACHE.has(file))
        ) {
          hitCount++
          continue
        }

        try {
          const rawCode = fs.readFileSync(file, 'utf-8')

          // Run transformSource hooks before hashing so the contentHash
          // accounts for transform output. This makes the cache work safely
          // even when plugins like @bdocs/plugin-math modify the source.
          let sourceCode = rawCode
          if (hasTransformSource) {
            const lifecycle = getLifecycle?.()
            if (lifecycle) {
              try {
                const result = await lifecycle.runChain('transformSource', {
                  code: rawCode,
                  filePath: file,
                })
                if (result?.code) sourceCode = result.code
              } catch {
                // Lifecycle transform failed, continue with raw source
              }
            }
          }

          // Hash the POST-transform source so cache validates against
          // what the compiler actually receives.
          const contentHash = hashInput(sourceCode)
          rawContentMap.set(file, sourceCode)

          const cachedEntry = manifest[file]

          // Validate cache with POST-transform hash.
          // When transformSource changes (plugin update), the hash will
          // differ and correctly trigger recompilation.
          if (
            cachedEntry &&
            cachedEntry.contentHash === contentHash &&
            fs.existsSync(cachedEntry.outFile)
          ) {
            // PR-03: Don't read cached file content into PRE_COMPILED_CACHE.
            // The load() hook will lazy-load it on-demand via MANIFEST_CACHE.
            // This avoids reading 200+ cached files sequentially (~1s) just
            // to build the barrel index on builds where only 1 file changed.
            hitCount++
            continue
          }

          missCount++

          // P2-22: Try compile pool first (parallel worker threads, ~2-4x faster)
          let compiled: string | null = null
          if (compilePool && !compilePool.terminated) {
            const poolResult = await compilePool.compile({
              sourceCode,
              filePath: file,
            })
            if (poolResult.success) {
              compiled = poolResult.compiledCode
            }
            // If pool failed (worker crashed), fall through to in-process
          }

          // Fallback: in-process compilation via MdxCompiler
          if (compiled === null) {
            try {
              compiled = await compiler.compile(sourceCode, file)
            } catch {
              // Compilation failed — will be compiled on-the-fly by load()
            }
          }

          if (compiled) {
            PRE_COMPILED_CACHE.set(file, compiled)
          }
        } catch {
          // Pre-compile failed, will compile on-the-fly
        }
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()))

    // === Write individual compiled pages + barrel index ===
    // PR-03: Collect ALL entries (both newly compiled in PRE_COMPILED_CACHE
    // and lazily cached in MANIFEST_CACHE) to build a complete barrel index.
    // Previously we only used PRE_COMPILED_CACHE.entries(), but that misses
    // files that were skipped by the worker fast path (MANIFEST_CACHE hit).
    const allEntryPaths = new Set<string>()
    for (const fp of mdxFiles) {
      if (PRE_COMPILED_CACHE.has(fp) || MANIFEST_CACHE.has(fp)) {
        allEntryPaths.add(fp)
      }
    }

    // Also include entries from PRE_COMPILED_CACHE that aren't in mdxFiles
    // (e.g. pages that were deleted — we keep the compiled file for now but
    // don't include them in the barrel index or manifest).
    const newlyCompiledFiles = Array.from(PRE_COMPILED_CACHE.entries()).filter(
      ([filePath]) => allEntryPaths.has(filePath),
    )

    if (allEntryPaths.size === 0) return

    fs.mkdirSync(pagesDir, { recursive: true })

    const pageMap: Record<string, string> = {}
    const reexports: string[] = []
    const mdxFilesSet = new Set(mdxFiles)
    // PR-03: Start from the existing manifest and overlay new/changed entries.
    // This preserves entries for cached files that weren't re-compiled.
    const newManifest: PrecompileManifest['files'] = { ...manifest }

    // Write out newly compiled (or loaded) files from PRE_COMPILED_CACHE
    for (const [filePath, compiledCode] of newlyCompiledFiles) {
      const exportName = filePathToExportName(filePath)
      const outFile = path.join(pagesDir, `${exportName}.mjs`)
      const existingEntry = manifest[filePath]

      // Skip rewrite if the bytes are identical to avoid FS thrash and Vite
      // module graph invalidation.
      if (
        !existingEntry ||
        !fs.existsSync(outFile) ||
        fs.readFileSync(outFile, 'utf-8') !== compiledCode
      ) {
        fs.writeFileSync(outFile, compiledCode, 'utf-8')
      }

      // Use the POST-transform source for the hash so the cache key
      // matches what the compiler actually compiled.
      const sourceForHash =
        rawContentMap.get(filePath) ?? fs.readFileSync(filePath, 'utf-8')
      newManifest[filePath] = {
        contentHash: hashInput(sourceForHash),
        exportName,
        outFile,
        mtime: fs.statSync(filePath).mtimeMs,
      }
    }

    // Build barrel index exports for ALL entries (cached + newly compiled)
    for (const filePath of allEntryPaths) {
      const exportName = filePathToExportName(filePath)
      reexports.push(
        `export { default as ${exportName} } from '/.boltdocs/compiled/pages/${exportName}.mjs';`,
      )
      pageMap[filePath] = exportName

      // If this file is in MANIFEST_CACHE but not yet in newManifest
      // (i.e. it was cached and not re-compiled), preserve its manifest entry
      if (!newManifest[filePath]) {
        const cachedEntry = MANIFEST_CACHE.get(filePath)
        if (cachedEntry) {
          newManifest[filePath] = {
            contentHash: manifest[filePath]?.contentHash ?? '',
            exportName: cachedEntry.exportName,
            outFile: cachedEntry.outFile,
            mtime: fs.existsSync(filePath) ? fs.statSync(filePath).mtimeMs : 0,
          }
        }
      }
    }

    // Clean up manifest entries for files that no longer exist
    for (const key of Object.keys(newManifest)) {
      if (!mdxFilesSet.has(key)) {
        delete newManifest[key]
      }
    }

    // Build glob-compatible map: key = /{docsDirName}/relative-path, value = exportName
    const globMap: Record<string, string> = {}
    const docsDirAbs = path.resolve(docsDir)
    for (const filePath of allEntryPaths) {
      const exportName = pageMap[filePath] || filePathToExportName(filePath)
      const relPath = path.relative(docsDirAbs, filePath)
      if (!relPath.startsWith('..')) {
        const globKey =
          '/' + docsDirName + '/' + relPath.split(path.sep).join('/')
        globMap[globKey] = exportName
      }
    }

    // Write barrel index + glob map + manifest
    fs.writeFileSync(pagesIndexFile, reexports.join('\n'), 'utf-8')
    fs.writeFileSync(globMapFile, JSON.stringify(globMap), 'utf-8')
    writeManifest(root, globalKey, newManifest)

    // ── PR-06: Write combined single file for SSR ────────────────────
    // Read all individual compiled files and combine into ONE module.
    // Each page is wrapped in an IIFE for scope isolation.  Imports are
    // properly deduplicated by source module using mergeImportLine() —
    // if two pages import different named exports from the same package,
    // they become ONE import statement.  Result: Vite/Rolldown processes
    // 1 module instead of N, saving ~10-15s in SSR bundling.
    const combinedFile = path.join(pagesDir, 'combined.mjs')
    const pageEntries: Array<{ key: string; body: string }> = []
    const docsDirAbs2 = path.resolve(docsDir)

    // structured import storage: source → { defaultName, named[], star }
    const mergedImports = new Map<
      string,
      { defaultName: string | null; named: Set<string>; star: string | null }
    >()

    for (const filePath of Object.keys(pageMap)) {
      const exportName = pageMap[filePath]
      const outFile = path.join(pagesDir, `${exportName}.mjs`)
      if (!fs.existsSync(outFile)) continue

      const relPath = path.relative(docsDirAbs2, filePath)
      if (relPath.startsWith('..')) continue
      const globKey =
        '/' + docsDirName + '/' + relPath.split(path.sep).join('/')

      const content = fs.readFileSync(outFile, 'utf-8')
      const lines = content.split('\n')

      const bodyLines: string[] = []
      let inImports = true

      for (const line of lines) {
        if (inImports) {
          const trimmed = line.trim()
          if (trimmed.startsWith('import ')) {
            mergeImportLine(mergedImports, trimmed)
          } else if (!trimmed.startsWith('export default')) {
            inImports = false
            if (trimmed) bodyLines.push(line)
          }
        } else {
          if (!line.trim().startsWith('export default')) {
            bodyLines.push(line)
          }
        }
      }

      pageEntries.push({ key: globKey, body: bodyLines.join('\n') })
    }

    // Generate merged import lines
    const mergedImportLines: string[] = []
    for (const [source, info] of mergedImports) {
      const parts: string[] = []
      if (info.defaultName) {
        parts.push(info.defaultName)
      }
      if (info.named.size > 0) {
        const namedList = Array.from(info.named).join(', ')
        parts.push(`{ ${namedList} }`)
      }
      if (info.star) {
        parts.push(`* as ${info.star}`)
      }
      mergedImportLines.push(`import ${parts.join(', ')} from '${source}'`)
    }

    // Build combined file content
    const combinedLines: string[] = []
    combinedLines.push(
      '// Auto-generated combined file for SSR — single module instead of ' +
        pageEntries.length +
        ' individual files',
    )
    combinedLines.push('')
    for (const imp of mergedImportLines) combinedLines.push(imp)
    if (mergedImportLines.length > 0) combinedLines.push('')
    combinedLines.push('var __pages = {};')
    combinedLines.push('')

    for (const { key, body } of pageEntries) {
      combinedLines.push('// Page: ' + key)
      combinedLines.push('(function() {')
      if (body.trim()) {
        combinedLines.push(body)
      }
      // PR-06: `var _createMdxContent` and `function MDXContent` inside the
      // IIFE are scoped to the IIFE.  The fallback `typeof MDXContent === "undefined"`
      // triggers if the compiled page uses inline `export default function MDXContent`
      // (all on one line) which the stripping above would remove entirely.
      combinedLines.push(
        `if (typeof MDXContent === "undefined") { console.warn("[satteri-mdx] combined: MDXContent not defined for '${key}'"); }`,
      )
      combinedLines.push(
        `__pages['${key}'] = { default: typeof MDXContent !== "undefined" ? MDXContent : function() { return null } };`,
      )
      combinedLines.push('})();')
      combinedLines.push('')
    }

    combinedLines.push('export default __pages;')
    fs.writeFileSync(combinedFile, combinedLines.join('\n'), 'utf-8')

    // ── P2-20: Write client chunk packs for ALL sites > 25 pages ──
    // Groups pages into chunks of 25 to reduce Vite/Rolldown module count
    // from N (202) to K (8). Each chunk replaces ~25 individual dynamic
    // imports with 1, saving ~4-5s in client build time.
    // For ≤25 pages, keep individual imports (small site, negligible diff).
    const PAGES_PER_CHUNK = 25

    // Remove any old chunk files from previous builds
    // (also cleans up files from the old 500-page threshold)
    const oldChunks = fs
      .readdirSync(pagesDir)
      .filter((f) => f.startsWith('chunk-') && f.endsWith('.mjs'))
    for (const oldChunk of oldChunks) {
      try {
        fs.unlinkSync(path.join(pagesDir, oldChunk))
      } catch {}
    }
    const oldChunkMapFile = path.join(compileDir, 'pages-chunk-map.json')
    if (fs.existsSync(oldChunkMapFile)) {
      try {
        fs.unlinkSync(oldChunkMapFile)
      } catch {}
    }

    // P2-20.4: Write shared imports chunk (_shared.mjs) so every page chunk
    // doesn't repeat the same import lines.  Each chunk imports _shared.mjs
    // once instead of inlining all mergedImportLines.
    if (pageEntries.length > PAGES_PER_CHUNK && mergedImportLines.length > 0) {
      const sharedImportFile = path.join(pagesDir, '_shared.mjs')
      const sharedContent = [
        '// Auto-generated shared imports — included by all page chunks',
        '',
        ...mergedImportLines,
        '',
      ].join('\n')
      // Skip rewrite if unchanged (avoid FS thrash + Vite module graph invalidation)
      const existingShared = fs.existsSync(sharedImportFile)
        ? fs.readFileSync(sharedImportFile, 'utf-8')
        : ''
      if (existingShared !== sharedContent) {
        fs.writeFileSync(sharedImportFile, sharedContent, 'utf-8')
      }
    }

    if (pageEntries.length > PAGES_PER_CHUNK) {
      const chunkCount = Math.ceil(pageEntries.length / PAGES_PER_CHUNK)
      const chunkMap = {}

      for (let chunkIdx = 0; chunkIdx < chunkCount; chunkIdx++) {
        const start = chunkIdx * PAGES_PER_CHUNK
        const end = Math.min(start + PAGES_PER_CHUNK, pageEntries.length)
        const group = pageEntries.slice(start, end)

        const chunkLines = []
        chunkLines.push(
          '// Auto-generated client chunk ' +
            chunkIdx +
            ' \u2014 ' +
            group.length +
            ' pages combined',
        )
        chunkLines.push('')
        for (const imp of mergedImportLines) {
          chunkLines.push(imp)
        }
        chunkLines.push('')
        chunkLines.push('var __pages = {};')
        chunkLines.push('')

        for (const { key, body } of group) {
          chunkLines.push('(function() {')
          if (body.trim()) chunkLines.push(body)
          chunkLines.push(
            `if (typeof MDXContent === "undefined") { console.warn("[satteri-mdx] chunk ${chunkIdx}: MDXContent not defined for '${key}'"); }`,
          )
          chunkLines.push(
            `__pages['${key}'] = { default: typeof MDXContent !== "undefined" ? MDXContent : function() { return null } };`,
          )
          chunkLines.push('})();')
          chunkLines.push('')
          chunkMap[key] = chunkIdx
        }

        chunkLines.push('export default __pages;')
        fs.writeFileSync(
          path.join(pagesDir, 'chunk-' + chunkIdx + '.mjs'),
          chunkLines.join('\n'),
          'utf-8',
        )
      }

      // Write chunk map for the entry code to use
      const chunkMapPath = path.join(compileDir, 'pages-chunk-map.json')
      fs.writeFileSync(chunkMapPath, JSON.stringify(chunkMap), 'utf-8')
      console.log(
        '[satteri-mdx] client chunks: ' +
          chunkCount +
          ' chunk(s) for ' +
          pageEntries.length +
          ' pages (' +
          PAGES_PER_CHUNK +
          ' per chunk)',
      )
    }

    COMPILED_PAGES_INDEX_PATH = pagesIndexFile
    COMPILED_PAGES_MAP = pageMap

    // Also populate MDX_GLOB_MAP for entry code
    MDX_GLOB_MAP.clear()
    for (const [filePath, exportName] of Object.entries(pageMap)) {
      MDX_GLOB_MAP.set(filePath, exportName)
    }

    _precompileCompleted = true

    const totalTime = Math.round(performance.now() - startTime)
    // eslint-disable-next-line no-console
    console.log(
      `[satteri-mdx] precompile: ${hitCount} hit / ${missCount} miss / ${totalTime}ms`,
    )
    // eslint-disable-next-line no-console
    console.log(
      `[boltdocs] { name: 'MDX precompile', duration: ${totalTime}, success: true, details: '${hitCount} hit / ${missCount} miss / ${mdxFiles.length} files' }`,
    )
  }

  return {
    name: 'vite-plugin-boltdocs-satteri-mdx',
    enforce: 'pre',

    /**
     * P2-21: On warm/cold-dist builds, don't start precompile here — the
     * pipeline already started it earlier (via precompile-bridge).
     * buildStart() will await the bridge promise instead.
     *
     * On true cold builds, kick off precompile in the background so it can
     * overlap with Vite's remaining config resolution.
     */
    configResolved(resolved) {
      viteResolvedConfig = resolved

      if (isPrecompileStarted()) {
        // Pipeline already handling precompile (P2-21). Don't start again.
        return
      }

      // Kick off pre-compilation in the background so it can overlap with
      // the main boltdocs config() hook (route generation, type generation)
      // and Vite's own setup. buildStart() will await the result.
      // P2-22: Compile pool is created lazily inside runPreCompile() only
      // when there are actual cache misses (avoids worker init on warm builds).
      if (process.env.NODE_ENV === 'production' || process.env.CI) {
        preCompilePromise = runPreCompile().catch(() => {})
      }
    },

    /**
     * P2-21: Pre-compile ALL MDX files before Vite starts processing modules.
     * First checks if precompile was already started by the pipeline (via
     * precompile-bridge) — if so, awaits that promise.
     *
     * Otherwise checks disk cache: if the manifest exists and all files are
     * cached, returns immediately without re-compiling (<10ms warm path).
     *
     * True cold builds fall through to runPreCompile() which does the full
     * compile cycle.
     */
    async buildStart() {
      if (process.env.NODE_ENV !== 'production' && !process.env.CI) return
      if (
        _precompileCompleted &&
        COMPILED_PAGES_INDEX_PATH &&
        fs.existsSync(COMPILED_PAGES_INDEX_PATH)
      ) {
        return
      }

      const buildStartTime = performance.now()

      // P2-21: Check if pipeline already started precompile (via bridge)
      const bridgePromise = getPrecompilePromise()
      if (bridgePromise) {
        await bridgePromise
        return
      }

      // P2-21: Fast path for warm/cold-dist builds — check disk cache first.
      // IMPORTANT: Read the raw manifest JSON directly instead of using
      // readManifest(root, LAST_GLOBAL_KEY).  LAST_GLOBAL_KEY is empty on
      // a fresh process start (it's only set by runPreCompile).  Since the
      // compiled files on disk are valid regardless of whether we've already
      // computed the global key in this process, we skip the key check here
      // and only verify that all files exist in the manifest.
      const root = viteResolvedConfig?.root || process.cwd()
      const docsDirName = pluginOptions?.docsDir || 'docs'
      const docsDir = path.join(root, docsDirName)
      if (fs.existsSync(docsDir)) {
        const manifestPath = getManifestPath(root)
        if (fs.existsSync(manifestPath)) {
          try {
            const raw = JSON.parse(
              fs.readFileSync(manifestPath, 'utf-8'),
            ) as PrecompileManifest
            if (raw?.files) {
              // Scan ALL MDX files on disk — not just manifest entries —
              // so newly-added files force a full precompile.  A file added
              // after the last build won't be in the manifest; checking it
              // here causes allCached=false and falls through to runPreCompile().
              // The ~20-50ms sync scan is acceptable for correctness.
              const mdxFiles = findMdxFiles(docsDir)
              const allCached =
                mdxFiles.length > 0 &&
                mdxFiles.every(
                  (f) => raw.files![f] && fs.existsSync(raw.files![f].outFile),
                )
              if (allCached) {
                // All files already cached — return fast (<10ms).
                // Load MANIFEST_CACHE for the load() hook.
                for (const [filePath, entry] of Object.entries(raw.files)) {
                  MANIFEST_CACHE.set(filePath, {
                    outFile: entry.outFile,
                    exportName: entry.exportName,
                  })
                }

                // Also populate module-level variables so runPreCompile()
                // and any external code that imports them see the correct
                // state even when the warm path shortcut is taken.
                const pagesDir = path.join(getCompileDir(root), 'pages')
                const pagesIndexFile = path.join(pagesDir, 'index.mjs')
                COMPILED_PAGES_INDEX_PATH = pagesIndexFile
                COMPILED_PAGES_MAP = {}
                for (const [filePath, entry] of Object.entries(raw.files)) {
                  COMPILED_PAGES_MAP[filePath] = entry.exportName
                }
                MDX_GLOB_MAP.clear()
                for (const [filePath, entry] of Object.entries(raw.files)) {
                  MDX_GLOB_MAP.set(filePath, entry.exportName)
                }

                return
              }
            }
          } catch {
            // Manifest corrupt or unreadable — fall through to runPreCompile
          }
        }
      }

      // Cold build / uncached: start precompilation in configResolved hook
      // so worker compilation runs concurrently while Vite builds its module graph
      if (!preCompilePromise) {
        preCompilePromise = runPreCompile()
      }

      // If pre-compilation was started in configResolved, wait for it here.
      // Otherwise run it now.
      if (preCompilePromise) {
        await preCompilePromise
      } else {
        await runPreCompile()
      }

      const totalTime = Math.round(performance.now() - buildStartTime)
      // eslint-disable-next-line no-console
      console.log(`[satteri-mdx] buildStart completed in ${totalTime}ms`)
    },

    async load(id) {
      if (!isMdx(id)) return null

      const [cleanId] = id.split('?')

      // 1. Check PRE_COMPILED_CACHE first (fastest — from a previous
      //    on-demand load within the same process).
      const cached = PRE_COMPILED_CACHE.get(cleanId)
      if (cached) {
        _precompiledIds.add(cleanId)
        return cached
      }

      // 2. PR-03: Lazy-load from MANIFEST_CACHE (avoids pre-populating all
      //    202+ files at once).  Reads the cached outFile on-demand and
      //    stores it in PRE_COMPILED_CACHE for subsequent requests.
      const manifestEntry = MANIFEST_CACHE.get(cleanId)
      if (manifestEntry && fs.existsSync(manifestEntry.outFile)) {
        try {
          const content = fs.readFileSync(manifestEntry.outFile, 'utf-8')
          PRE_COMPILED_CACHE.set(cleanId, content)
          _precompiledIds.add(cleanId)
          return content
        } catch {
          // File vanished between existsSync and readFileSync — fall through
        }
      }

      // 3. Fallback: compile on-the-fly
      let rawCode: string
      try {
        rawCode = fs.readFileSync(cleanId, 'utf-8')
      } catch {
        return null
      }

      let sourceCode = rawCode
      if (shouldRunTransformSource()) {
        const lifecycle = getLifecycle?.()
        if (lifecycle) {
          try {
            const result = await lifecycle.runChain('transformSource', {
              code: rawCode,
              filePath: cleanId,
            })
            if (result?.code) sourceCode = result.code
          } catch {
            // Lifecycle chain error, continue with raw source
          }
        }
      }

      const compiled = await compiler.compile(sourceCode, cleanId)
      if (!compiled) {
        throw new Error(
          `[satteri-mdx] Failed to compile ${cleanId}: compiler returned no output`,
        )
      }
      _precompiledIds.add(cleanId)
      return compiled
    },

    async transform(code, id) {
      if (!isMdx(id)) return null

      // Code from load() is already pre-compiled by Sätteri. The only case
      // where raw MDX reaches transform() is for files NOT in the docs dir
      // (e.g. dynamic imports, virtual modules). Those get compiled here.
      const cleanId = id.split('?')[0]
      let finalCode = code as string
      if (!_precompiledIds.has(cleanId) && !looksCompiled(finalCode)) {
        finalCode = await compiler.compile(finalCode, cleanId)
      }

      let codeResult = finalCode
      if (shouldRunTransformMdx()) {
        const lifecycle = getLifecycle?.()
        if (lifecycle) {
          try {
            const result = await lifecycle.runChain('transformMdx', {
              code: finalCode,
              filePath: cleanId,
            })
            if (result?.code) codeResult = result.code
          } catch {
            // Lifecycle chain error, continue with compiled code
          }
        }
      }

      return { code: codeResult, map: null }
    },

    async buildEnd() {
      // PR-03: Keep PRE_COMPILED_CACHE in memory between builds.  Only clear
      // when the manifest globalKey changes (compiler version, plugins, env,
      // or config changed).  This avoids re-reading all cached files from
      // disk on successive builds.
      try {
        const root = viteResolvedConfig?.root || process.cwd()
        const docsDirName = pluginOptions?.docsDir || 'docs'
        const docsDir = path.join(root, docsDirName)
        if (fs.existsSync(docsDir)) {
          const mdxFiles = findMdxFiles(docsDir)
          const manifest = readManifest(root, LAST_GLOBAL_KEY)
          if (!manifest) {
            // globalKey mismatch or no manifest — clear everything
            PRE_COMPILED_CACHE.clear()
            MANIFEST_CACHE.clear()
          } else {
            // Same globalKey — only remove entries for files that no longer
            // exist in the manifest (e.g. deleted pages).
            for (const key of PRE_COMPILED_CACHE.keys()) {
              if (!manifest[key]) PRE_COMPILED_CACHE.delete(key)
            }
            for (const key of MANIFEST_CACHE.keys()) {
              if (!manifest[key]) MANIFEST_CACHE.delete(key)
            }
          }
        }
      } catch {
        // Non-critical: cache cleanup is best-effort
      }

      await compiler.flushCache()

      // P2-22: Terminate compile pool and log metrics
      if (compilePool && !compilePool.terminated) {
        poolMetrics = compilePool.metrics
        await compilePool.terminate()
        if (poolMetrics.totalJobs > 0) {
          // eslint-disable-next-line no-console
          console.log(
            `[satteri-mdx] compile pool: ${poolMetrics.successfulJobs} done / ${poolMetrics.failedJobs} failed / ${poolMetrics.healthyWorkers} workers / ${poolMetrics.totalTimeMs}ms`,
          )
        }
      }
    },
  }
}
