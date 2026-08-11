import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { FileCache } from '../cache'
import type { BoltdocsConfig } from '../config'
import type { DirectoryMeta, ParsedDocFile, RouteMeta } from './types'
import { ParserCache } from './parser/cache'
import { getCacheConfig } from '../utils'

export interface DirectoryMetaCacheEntry {
  mtimeMs: number
  size: number
  content: DirectoryMeta
}

export interface RouteDiscoverySnapshot {
  version: 1
  files: string[]
  directoryMetaFiles: string[]
  directories: Record<string, number>
}

export interface RouteCacheVariant {
  readonly fingerprint: string
  readonly docCache: FileCache<ParsedDocFile>
  readonly parserCache: ParserCache
  cachedFileList: string[] | null
  localizedPathCache: Map<string, string>
  cachedNativeDocs: Record<string, any> | null
  frontmatterHashes: Map<string, string>
  directoryMeta: Record<string, DirectoryMeta> | null
  cachedDirectoryMetaFiles: string[] | null
  directoryMetaEntries: Map<string, DirectoryMetaCacheEntry>
  discoverySnapshot: RouteDiscoverySnapshot | null
  discoverySnapshotLoaded: boolean
  readonly discoverySnapshotPath: string
}

export interface RouteCacheContext {
  readonly docsDir: string
  readonly cacheRoot: string
  /** Legacy active cache facade used by HMR/plugin consumers. */
  docCache: FileCache<ParsedDocFile>
  parserCache: ParserCache
  cachedFileList: string[] | null
  localizedPathCache: Map<string, string>
  cachedNativeDocs: Record<string, any> | null
  frontmatterHashes: Map<string, string>
  directoryMeta: Record<string, DirectoryMeta> | null
  cachedDirectoryMetaFiles: string[] | null
  readonly variants: Map<string, RouteCacheVariant>
  activeVariant: RouteCacheVariant | null
  activeGenerations: Map<string, Promise<RouteMeta[]>>
  generationEpoch: number
  disposed: boolean
}

function normalizeDocsDir(docsDir: string): string {
  return path.resolve(docsDir)
}

function getCacheNamespace(docsDir: string, fingerprint: string): string {
  return crypto
    .createHash('sha1')
    .update(`${normalizeDocsDir(docsDir)}:${fingerprint}`)
    .digest('hex')
    .slice(0, 16)
}

function createVariant(
  docsDir: string,
  cacheRoot: string,
  fingerprint: string,
): RouteCacheVariant {
  const namespace = getCacheNamespace(docsDir, fingerprint)
  const cacheConfig = getCacheConfig()
  return {
    fingerprint,
    docCache: new FileCache<ParsedDocFile>({
      name: `routes-${namespace}`,
      root: cacheRoot,
    }),
    parserCache: new ParserCache(cacheRoot, namespace),
    cachedFileList: null,
    localizedPathCache: new Map(),
    cachedNativeDocs: null,
    frontmatterHashes: new Map(),
    directoryMeta: null,
    cachedDirectoryMetaFiles: null,
    directoryMetaEntries: new Map(),
    discoverySnapshot: null,
    discoverySnapshotLoaded: false,
    discoverySnapshotPath: path.resolve(
      cacheRoot,
      cacheConfig.dir,
      `route-discovery-${namespace}.json`,
    ),
  }
}

export function createRouteCacheContext(
  docsDir: string,
  cacheRoot: string = path.dirname(path.resolve(docsDir)),
): RouteCacheContext {
  const normalizedDocsDir = normalizeDocsDir(docsDir)
  const normalizedCacheRoot = path.resolve(cacheRoot)
  const legacy = createVariant(normalizedDocsDir, normalizedCacheRoot, 'legacy')

  return {
    docsDir: normalizedDocsDir,
    cacheRoot: normalizedCacheRoot,
    docCache: legacy.docCache,
    parserCache: legacy.parserCache,
    cachedFileList: legacy.cachedFileList,
    localizedPathCache: legacy.localizedPathCache,
    cachedNativeDocs: legacy.cachedNativeDocs,
    frontmatterHashes: legacy.frontmatterHashes,
    directoryMeta: legacy.directoryMeta,
    cachedDirectoryMetaFiles: legacy.cachedDirectoryMetaFiles,
    variants: new Map([['legacy', legacy]]),
    activeVariant: legacy,
    activeGenerations: new Map(),
    generationEpoch: 0,
    disposed: false,
  }
}

const contexts = new Map<string, RouteCacheContext>()
const MAX_ROUTE_CACHE_VARIANTS = 8

/**
 * Return the independent cache variant for a route-generation fingerprint.
 * The returned object is stable and safe to capture for the whole generation.
 */
export function getRouteCacheVariant(
  context: RouteCacheContext,
  fingerprint: string,
  activate = false,
): RouteCacheVariant {
  if (context.disposed) {
    throw new Error('[boltdocs] Route cache context has been disposed.')
  }
  let variant = context.variants.get(fingerprint)
  if (!variant) {
    variant = createVariant(context.docsDir, context.cacheRoot, fingerprint)
    context.variants.set(fingerprint, variant)

    if (context.variants.size > MAX_ROUTE_CACHE_VARIANTS) {
      for (const [key, candidate] of context.variants) {
        if (key === fingerprint || candidate === context.activeVariant) continue
        if (!context.activeGenerations.has(key)) {
          context.variants.delete(key)
          break
        }
      }
    }
  }

  // Legacy consumers may opt into the active facade. New generation paths
  // capture the returned variant and leave this shared facade untouched.
  if (activate) {
    context.activeVariant = variant
    context.docCache = variant.docCache
    context.parserCache = variant.parserCache
    context.cachedFileList = variant.cachedFileList
    context.localizedPathCache = variant.localizedPathCache
    context.cachedNativeDocs = variant.cachedNativeDocs
    context.frontmatterHashes = variant.frontmatterHashes
    context.directoryMeta = variant.directoryMeta
    context.cachedDirectoryMetaFiles = variant.cachedDirectoryMetaFiles
  }
  return variant
}

/** Compatibility helper retained for internal callers from the previous phase. */
export function configureRouteCacheContext(
  context: RouteCacheContext,
  fingerprint: string,
): RouteCacheVariant {
  return getRouteCacheVariant(context, fingerprint, true)
}

/** Keep the legacy facade aligned after a generation updates its active variant. */
export function syncRouteCacheFacade(
  context: RouteCacheContext,
  variant: RouteCacheVariant,
): void {
  if (context.activeVariant !== variant) return
  context.cachedFileList = variant.cachedFileList
  context.cachedNativeDocs = variant.cachedNativeDocs
  context.frontmatterHashes = variant.frontmatterHashes
  context.directoryMeta = variant.directoryMeta
  context.cachedDirectoryMetaFiles = variant.cachedDirectoryMetaFiles
}

/**
 * Return the cache fingerprint for the route-affecting part of a config.
 * Keeping this subset explicit avoids serializing plugin instances or other
 * non-route state and makes concurrent generations deterministic.
 */
export function getRouteGenerationFingerprint(
  config?: BoltdocsConfig,
  basePath?: string,
): string {
  return crypto
    .createHash('sha1')
    .update(
      JSON.stringify({
        basePath: basePath || config?.base || '/docs',
        i18n: config?.i18n,
        versions: config?.versions,
        drafts: config?.drafts,
        featureFlags: config?.featureFlags,
        sidebarGroups: config?.theme?.sidebarGroups,
      }),
    )
    .digest('hex')
}

export function disposeRouteCacheContext(
  docsDir: string,
  context?: RouteCacheContext,
): void {
  const normalized = normalizeDocsDir(docsDir)
  const current = contexts.get(normalized)
  const target = context ?? current
  if (!target || current === target) contexts.delete(normalized)

  if (target) {
    target.disposed = true
    target.generationEpoch++
    target.activeGenerations.clear()
    target.variants.clear()
    target.activeVariant = null
    target.cachedFileList = null
    target.localizedPathCache.clear()
    target.cachedNativeDocs = null
    target.frontmatterHashes.clear()
    target.directoryMeta = null
    target.cachedDirectoryMetaFiles = null
  }
}

export function getRouteCacheContext(docsDir: string): RouteCacheContext {
  const normalized = normalizeDocsDir(docsDir)
  let context = contexts.get(normalized)
  if (!context) {
    context = createRouteCacheContext(normalized)
    contexts.set(normalized, context)
  }
  return context
}

const legacyContext = createRouteCacheContext(
  path.resolve(process.cwd(), 'docs'),
)
const docCache = legacyContext.docCache

function removeDiscoverySnapshot(variant: RouteCacheVariant): void {
  try {
    fs.rmSync(variant.discoverySnapshotPath, { force: true })
  } catch {
    // A stale snapshot is never required for correctness.
  }
}

export function invalidateRouteCache(
  contextOrDocsDir?: RouteCacheContext | string,
): void {
  const target =
    typeof contextOrDocsDir === 'string'
      ? getRouteCacheContext(contextOrDocsDir)
      : (contextOrDocsDir ?? legacyContext)
  for (const variant of target.variants.values()) {
    variant.cachedFileList = null
    variant.localizedPathCache.clear()
    variant.cachedNativeDocs = null
    variant.frontmatterHashes.clear()
    variant.directoryMeta = null
    variant.cachedDirectoryMetaFiles = null
    variant.discoverySnapshot = null
    variant.discoverySnapshotLoaded = false
    removeDiscoverySnapshot(variant)
    // Keep per-file metadata entries. The next crawl prunes deleted files and
    // the stat tuple lets unchanged meta.json files be reused after an MDX
    // invalidation, so unrelated edits do not cause a full metadata reread.
    variant.docCache.invalidateAll()
    variant.parserCache.clear()
  }
  target.cachedFileList = null
  target.localizedPathCache.clear()
  target.cachedNativeDocs = null
  target.frontmatterHashes.clear()
  target.directoryMeta = null
  target.cachedDirectoryMetaFiles = null
  target.generationEpoch++
}

export function invalidateDirectoryMetaFile(
  filePath: string,
  contextOrDocsDir?: RouteCacheContext | string,
): void {
  const target =
    typeof contextOrDocsDir === 'string'
      ? getRouteCacheContext(contextOrDocsDir)
      : (contextOrDocsDir ?? legacyContext)
  const normalizedFile = path.resolve(filePath)
  for (const variant of target.variants.values()) {
    for (const cachedFile of variant.directoryMetaEntries.keys()) {
      if (path.resolve(cachedFile) === normalizedFile) {
        variant.directoryMetaEntries.delete(cachedFile)
      }
    }
    variant.directoryMeta = null
    variant.cachedDirectoryMetaFiles = null
    variant.discoverySnapshot = null
    variant.discoverySnapshotLoaded = false
    removeDiscoverySnapshot(variant)
  }
  target.directoryMeta = null
  target.cachedDirectoryMetaFiles = null
  target.generationEpoch++
}

export function invalidateFile(
  filePath: string,
  contextOrDocsDir?: RouteCacheContext | string,
): void {
  const target =
    typeof contextOrDocsDir === 'string'
      ? getRouteCacheContext(contextOrDocsDir)
      : (contextOrDocsDir ?? legacyContext)
  for (const variant of target.variants.values()) {
    variant.docCache.invalidate(filePath)
    variant.parserCache.invalidate(filePath)
    variant.cachedNativeDocs?.[filePath.replace(/\\/g, '/')] &&
      delete variant.cachedNativeDocs[filePath.replace(/\\/g, '/')]
    variant.frontmatterHashes.delete(filePath)
  }
  target.cachedNativeDocs = target.activeVariant?.cachedNativeDocs ?? null
  target.frontmatterHashes.delete(filePath)
  target.generationEpoch++
}

export { docCache }
