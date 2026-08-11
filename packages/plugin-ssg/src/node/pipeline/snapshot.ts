import { isAbsolute, join, relative } from 'node:path'
import type { InlineConfig } from 'vite'
import type { RouteRecord, ViteReactSSGOptions } from '../../types'
import { getCanonicalRouteKey } from '../cache-io'

export interface SsgRouteSnapshot {
  readonly path: string
  readonly key: string
  readonly sourceFile?: string
  readonly componentPath?: string
  readonly locale?: string
  readonly version?: string
  readonly collection?: string
  readonly contentHash?: string
}

export interface SsgRouteManifest {
  readonly routes: readonly SsgRouteSnapshot[]
  readonly byPath: ReadonlyMap<string, SsgRouteSnapshot>
  readonly sourceFiles: Readonly<Record<string, string>>
}

export interface SsgBuildSnapshot {
  readonly root: string
  readonly outDir: string
  readonly cacheDir: string
  readonly base: string
  readonly mode: string
  readonly entry: string
  readonly htmlEntry: string
  readonly docsDirName: string
  readonly clientHash: string
  readonly sourceFiles: Readonly<Record<string, string>>
  readonly routeManifest?: SsgRouteManifest
}

export interface CreateSsgBuildSnapshotInput {
  readonly root: string
  readonly outDir: string
  readonly cacheDir: string
  readonly base: string
  readonly mode: string
  readonly entry: string
  readonly htmlEntry: string
  readonly docsDirName: string
  readonly clientHash: string
  readonly routeToSourceFileMap?: Readonly<Record<string, string>>
}

function normalizeSourceFile(root: string, sourceFile: string): string {
  return isAbsolute(sourceFile) ? sourceFile : join(root, sourceFile)
}

function normalizeSourceFiles(
  root: string,
  sourceFiles: Readonly<Record<string, string>> = {},
): Readonly<Record<string, string>> {
  const normalized: Record<string, string> = {}
  for (const [routePath, sourceFile] of Object.entries(sourceFiles)) {
    const key = getCanonicalRouteKey(routePath)
    normalized[key] = normalizeSourceFile(root, sourceFile)
  }
  return Object.freeze(normalized)
}

export function createSsgBuildSnapshot(
  input: CreateSsgBuildSnapshotInput,
): SsgBuildSnapshot {
  return Object.freeze({
    root: input.root,
    outDir: input.outDir,
    cacheDir: input.cacheDir,
    base: input.base,
    mode: input.mode,
    entry: input.entry,
    htmlEntry: input.htmlEntry,
    docsDirName: input.docsDirName,
    clientHash: input.clientHash,
    sourceFiles: normalizeSourceFiles(input.root, input.routeToSourceFileMap),
  })
}

export function createSsgRouteManifest(
  root: string,
  routes: readonly RouteRecord[],
  sourceFiles: Readonly<Record<string, string>> = {},
): SsgRouteManifest {
  const sourceByKey = normalizeSourceFiles(root, sourceFiles)
  const snapshots = routes.map((route) => {
    const key = getCanonicalRouteKey(route.path)
    const exactSource = sourceFiles[route.path]
    const sourceFile = exactSource
      ? normalizeSourceFile(root, exactSource)
      : sourceByKey[key] || route.componentPath
    return {
      path: route.path,
      key,
      sourceFile,
      componentPath: route.componentPath,
      locale: route.locale,
      version: route.version,
      collection: route.collection,
    }
  })
  const byPath = new Map<string, SsgRouteSnapshot>()
  for (const route of snapshots) {
    // Route generation should normally produce unique canonical paths. Keep
    // the first route on a slash-only collision so the manifest remains
    // deterministic and does not silently change based on map insertion order.
    if (!byPath.has(route.key)) byPath.set(route.key, route)
  }

  return Object.freeze({
    routes: Object.freeze(snapshots),
    byPath,
    sourceFiles: sourceByKey,
  })
}

export function attachSsgRouteManifest(
  snapshot: SsgBuildSnapshot,
  routeManifest: SsgRouteManifest,
): SsgBuildSnapshot {
  return Object.freeze({ ...snapshot, routeManifest })
}

/**
 * Keep this import-level assertion close to the contract so future refactors
 * cannot accidentally make the snapshot depend on Vite's mutable config.
 */
export function snapshotFromBuildInputs(
  options: Pick<ViteReactSSGOptions, 'mode' | 'entry' | 'htmlEntry'>,
  config: Pick<InlineConfig, 'base'>,
  input: Omit<
    CreateSsgBuildSnapshotInput,
    'base' | 'mode' | 'entry' | 'htmlEntry'
  >,
): SsgBuildSnapshot {
  return createSsgBuildSnapshot({
    ...input,
    base: config.base || '/',
    mode: options.mode || 'production',
    entry: options.entry || '',
    htmlEntry: options.htmlEntry || 'index.html',
  })
}

export function getSnapshotRelativeSourceFile(
  snapshot: SsgBuildSnapshot,
  sourceFile: string,
): string {
  return relative(snapshot.root, sourceFile).replace(/\\/g, '/')
}
