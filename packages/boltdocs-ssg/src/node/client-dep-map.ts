import crypto from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Manifest, SSRManifest, ManifestItem } from './types'

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
  /** Pre-computed chunk hashes to avoid reading the same file many times. */
  assetHashes?: Map<string, string>
  /**
   * Preloaded Sätteri compile map: `pages-chunk-map.json` (absolute MDX
   * path → chunk pack index). When provided and the route's page module is
   * only reachable through its chunk pack (chunk-N.mjs), the route's client
   * identity is derived from that pack's manifest entry instead of falling
   * back to the global client hash — the basis of per-route render
   * invalidation.
   */
  chunkPackMaps?: {
    chunkMap: Record<string, number>
  }
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
  assetHashes?: Map<string, string>,
): Promise<string> {
  // If a pre-computed hash map is available, combine those hashes in a
  // deterministic order. This avoids reading the same chunk file once per
  // route, which was a major hot spot during the SSG render phase.
  if (assetHashes) {
    const hasher = crypto.createHash('md5')
    for (const file of files) {
      const hash = assetHashes.get(file)
      if (hash) hasher.update(hash)
    }
    return hasher.digest('hex')
  }

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

async function hashRouteSource(
  routeSourceFile: string,
): Promise<string | undefined> {
  try {
    const source = await readFile(routeSourceFile)
    return crypto
      .createHash('md5')
      .update(source as Uint8Array)
      .digest('hex')
  } catch {
    return undefined
  }
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
    assetHashes,
    chunkPackMaps,
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
  } else if (chunkPackMaps) {
    // Strategy 1.5: the route's page module is only reachable through its
    // Sätteri chunk pack (chunk-N.mjs) — the compiled MDX lives in
    // .boltdocs/compiled/pages and never appears as a client module under
    // its source path. Map the source → chunk pack and use that pack's
    // manifest entry (plus its imports) as the route identity.
    //
    // Sätteri writes the map keys as ABSOLUTE MDX paths with an extra
    // leading slash (`//home/.../page.mdx`). The route map passed in may hold
    // either absolute paths or root-relative ones (`docs/guide.mdx`), so try
    // the raw value, its absolute-from-root form, and the double-slash form.
    const absoluteSource = path.isAbsolute(routeSourceFile)
      ? routeSourceFile
      : path.resolve(root, routeSourceFile)
    const chunkIdx =
      chunkPackMaps.chunkMap[routeSourceFile] ??
      chunkPackMaps.chunkMap[absoluteSource] ??
      chunkPackMaps.chunkMap[`/${absoluteSource}`]
    if (chunkIdx !== undefined) {
      for (const item of byFile.values()) {
        const src = item.src || ''
        if (
          src.includes(`chunk-${chunkIdx}.mjs`) ||
          item.file.includes(`chunk-${chunkIdx}`)
        ) {
          collectAssets(byFile, item.file, assets)
          break
        }
      }
    }
  }
  if (assets.size === 0) {
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
    const sourceHash = await hashRouteSource(routeSourceFile)
    if (sourceHash) return sourceHash
    if (clientHash) return clientHash
    throw new Error(
      `No client chunk found for ${routeSourceFile}; no source content and no global client hash were provided`,
    )
  }

  return hashAssetContents(outDir, Array.from(assets).sort(), assetHashes)
}
