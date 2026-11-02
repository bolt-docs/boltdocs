import crypto from 'node:crypto'
import { dirname, join } from 'node:path'
import fs from 'fs-extra'

interface ChunkHashCacheEntry {
  hash: string
  size: number
  mtimeMs: number
  ctimeMs: number
  ino: number
}

interface ChunkHashCacheFile {
  version: 1
  files: Record<string, ChunkHashCacheEntry>
}

function hashBuffer(buffer: Buffer): string {
  return crypto
    .createHash('md5')
    .update(buffer as Uint8Array)
    .digest('hex')
}

function isReusable(
  entry: ChunkHashCacheEntry | undefined,
  stat: fs.Stats,
): entry is ChunkHashCacheEntry {
  return Boolean(
    entry &&
      entry.size === stat.size &&
      entry.mtimeMs === stat.mtimeMs &&
      entry.ctimeMs === stat.ctimeMs &&
      entry.ino === stat.ino,
  )
}

async function readCache(
  cacheFile: string | undefined,
): Promise<ChunkHashCacheFile | undefined> {
  if (!cacheFile) return undefined

  try {
    const cache = await fs.readJson(cacheFile)
    if (!cache || cache.version !== 1 || typeof cache.files !== 'object') {
      return undefined
    }
    return cache as ChunkHashCacheFile
  } catch {
    return undefined
  }
}

async function writeCache(
  cacheFile: string,
  files: Record<string, ChunkHashCacheEntry>,
): Promise<void> {
  const temporaryFile = `${cacheFile}.${process.pid}.${Date.now()}.tmp`
  try {
    await fs.ensureDir(dirname(cacheFile))
    await fs.writeJson(temporaryFile, { version: 1, files }, { spaces: 0 })
    await fs.move(temporaryFile, cacheFile, { overwrite: true })
  } catch {
    await fs.remove(temporaryFile).catch(() => {})
  }
}

/**
 * Hash client chunks while reusing hashes from a previous build when the
 * filesystem identity and metadata are unchanged. The cache is an optimization
 * only: unreadable or malformed cache entries always fall back to reading the
 * chunk, preserving the route-asset hash contract.
 */
export async function computeChunkHashesWithCache(
  outDir: string,
  chunkFiles: readonly string[],
  cacheFile?: string,
): Promise<Map<string, string>> {
  const previous = await readCache(cacheFile)
  const hashes = new Map<string, string>()
  const nextFiles: Record<string, ChunkHashCacheEntry> = {}

  await Promise.all(
    [...new Set(chunkFiles)].map(async (file) => {
      const filePath = join(outDir, file)
      try {
        const stat = await fs.stat(filePath)
        if (!stat.isFile()) return

        const previousEntry = previous?.files[file]
        if (isReusable(previousEntry, stat)) {
          hashes.set(file, previousEntry.hash)
          nextFiles[file] = previousEntry
          return
        }

        const hash = hashBuffer(await fs.readFile(filePath))
        hashes.set(file, hash)
        nextFiles[file] = {
          hash,
          size: stat.size,
          mtimeMs: stat.mtimeMs,
          ctimeMs: stat.ctimeMs,
          ino: stat.ino,
        }
      } catch {
        // Missing or unreadable chunks remain absent, matching the previous
        // behavior and allowing the caller's global hash fallback to apply.
      }
    }),
  )

  if (cacheFile) await writeCache(cacheFile, nextFiles)
  return hashes
}
