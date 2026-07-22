import crypto from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Manifest, SSRManifest, ManifestItem } from './build'

export interface ManifestIndexes {
  byFile: Map<string, ManifestItem>
  bySrc: Map<string, ManifestItem>
}

export interface RouteClientHashOptions {
  outDir: string
  indexes?: ManifestIndexes
  manifest?: Manifest
  ssrManifest: SSRManifest
  routeSourceFile: string
  root: string
  /** Global client hash to use when a route-specific chunk cannot be found. */
  clientHash?: string
}

const chunkExts = new Set(['.js', '.mjs', '.css'])

function isChunkFile(file: string): boolean {
  const ext = path.extname(file).toLowerCase()
  return chunkExts.has(ext)
}

export function createManifestIndexes(manifest: Manifest): ManifestIndexes {
  const byFile = new Map<string, ManifestItem>()
  const bySrc = new Map<string, ManifestItem>()
  for (const item of Object.values(manifest)) {
    byFile.set(item.file, item)
    if (item.src) bySrc.set(item.src, item)
  }
  return { byFile, bySrc }
}

function collectAssets(
  byFile: Map<string, ManifestItem>,
  startFile: string,
  seen: Set<string>,
): void {
  if (seen.has(startFile)) return
  const chunk = byFile.get(startFile)
  if (!chunk) return
  seen.add(startFile)

  for (const imported of chunk.imports || []) {
    if (isChunkFile(imported)) collectAssets(byFile, imported, seen)
  }
  for (const css of chunk.css || []) {
    seen.add(css)
  }
  for (const dyn of chunk.dynamicImports || []) {
    if (isChunkFile(dyn) && !seen.has(dyn)) collectAssets(byFile, dyn, seen)
  }
}

async function hashAssetContents(
  outDir: string,
  files: string[],
): Promise<string> {
  const contents = new Map<string, Buffer>()
  await Promise.all(
    files.map(async (file) => {
      try {
        const buffer = await readFile(path.join(outDir, file))
        contents.set(file, buffer)
      } catch {
        // Ignore files that cannot be read
      }
    }),
  )

  const hasher = crypto.createHash('md5')
  // Update in a deterministic (sorted) order so the hash is stable across
  // runs even though the files were read in parallel.
  for (const file of Array.from(contents.keys()).sort()) {
    const buffer = contents.get(file)
    if (buffer) hasher.update(buffer as Uint8Array)
  }
  return hasher.digest('hex')
}

export async function computeRouteClientAssetHash(
  options: RouteClientHashOptions,
): Promise<string> {
  const {
    outDir,
    indexes,
    manifest,
    ssrManifest,
    routeSourceFile,
    root,
    clientHash,
  } = options

  let resolvedIndexes = indexes
  if (!resolvedIndexes) {
    if (!manifest) {
      throw new Error(
        'computeRouteClientAssetHash requires either indexes or manifest',
      )
    }
    resolvedIndexes = createManifestIndexes(manifest)
  }

  const { byFile, bySrc } = resolvedIndexes
  const relativeSource = path
    .relative(root, routeSourceFile)
    .replace(/\\/g, '/')
  const assets = new Set<string>()

  // Strategy 1: the route source itself is a chunk in the client manifest
  const entryChunk = bySrc.get(relativeSource)
  if (entryChunk) {
    collectAssets(byFile, entryChunk.file, assets)
  } else {
    // Strategy 2: use the SSR manifest to find client chunks for this module
    const keys = [relativeSource, routeSourceFile.replace(/\\/g, '/')]
    for (const key of keys) {
      const mapped = ssrManifest[key]
      if (!Array.isArray(mapped)) continue
      for (const file of mapped) {
        if (isChunkFile(file)) collectAssets(byFile, file, assets)
      }
    }
  }

  if (assets.size === 0) {
    // Fallback: if no route-specific chunk is found, use the global client
    // hash. Re-hashing the whole bundle here would be expensive and usually
    // unnecessary because `currentClientHash` already captures the entire
    // client code state.
    if (!clientHash) {
      throw new Error(
        `No client chunk found for ${routeSourceFile} and no global client hash was provided`,
      )
    }
    return clientHash
  }

  return hashAssetContents(outDir, Array.from(assets).sort())
}
