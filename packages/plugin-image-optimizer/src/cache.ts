import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

class BackgroundQueue {
  private activeTasks = new Set<Promise<any>>()

  add(task: () => Promise<any>) {
    const promise = Promise.resolve()
      .then(task)
      .catch(() => {})
      .finally(() => {
        this.activeTasks.delete(promise)
      })
    this.activeTasks.add(promise)
  }

  async flush() {
    await Promise.all(Array.from(this.activeTasks))
  }

  get pending() {
    return this.activeTasks.size
  }
}

const globalBackgroundQueue = new BackgroundQueue()

export class AssetCache {
  private readonly assetsDir: string
  private hashMap = new Map<string, { hash: string; mtime: number }>()

  constructor(root: string = process.cwd()) {
    const cacheDir = process.env.BOLTDOCS_CACHE_DIR || '.boltdocs/cache'
    this.assetsDir = path.resolve(root, cacheDir, 'assets')
  }

  async getFileHash(filePath: string): Promise<string> {
    const stat = await fsPromises.stat(filePath)
    const mtime = stat.mtimeMs
    const cached = this.hashMap.get(filePath)
    if (cached && cached.mtime === mtime) {
      return cached.hash
    }
    const hash = crypto
      .createHash('md5')
      .update(`${stat.size}-${mtime}`)
      .digest('hex')
    this.hashMap.set(filePath, { hash, mtime })
    return hash
  }

  async get(sourcePath: string, cacheKey: string): Promise<string | null> {
    try {
      const sourceHash = await this.getFileHash(sourcePath)
      const cachedPath = this.getCachedPath(
        sourcePath,
        `${cacheKey}-${sourceHash}`,
      )
      await fsPromises.access(cachedPath)
      return cachedPath
    } catch (e) {
      return null
    }
  }

  set(
    sourcePath: string,
    cacheKey: string,
    content: Buffer | string,
    sourceHash: string,
  ): void {
    const cachedPath = this.getCachedPath(
      sourcePath,
      `${cacheKey}-${sourceHash}`,
    )

    globalBackgroundQueue.add(async () => {
      try {
        await fsPromises.mkdir(this.assetsDir, { recursive: true })
        const tempPath = `${cachedPath}.${crypto.randomBytes(4).toString('hex')}.tmp`
        await fsPromises.writeFile(tempPath, content)
        await fsPromises.rename(tempPath, cachedPath)
      } catch (e) {
        // Ignore asset write errors
      }
    })
  }

  private getCachedPath(sourcePath: string, cacheKey: string): string {
    const ext = path.extname(sourcePath)
    const name = path.basename(sourcePath, ext)
    const safeKey = cacheKey.replace(/[^a-z0-9]/gi, '-').toLowerCase()
    return path.join(this.assetsDir, `${name}.${safeKey}${ext}`)
  }

  async pruneStale(validFilenames: Set<string>): Promise<void> {
    if (!fs.existsSync(this.assetsDir)) return
    const files = await fsPromises.readdir(this.assetsDir)
    for (const file of files) {
      if (!validFilenames.has(file)) {
        await fsPromises.unlink(path.join(this.assetsDir, file)).catch(() => {})
      }
    }
  }

  async enforceSizeLimit(
    maxSizeBytes: number = 10 * 1024 * 1024,
  ): Promise<void> {
    if (!fs.existsSync(this.assetsDir)) return
    const entries = await fsPromises.readdir(this.assetsDir)
    let totalSize = 0
    const files: { name: string; size: number; mtime: number }[] = []

    for (const name of entries) {
      const filePath = path.join(this.assetsDir, name)
      const stat = await fsPromises.stat(filePath).catch(() => null)
      if (!stat) continue
      totalSize += stat.size
      files.push({ name, size: stat.size, mtime: stat.mtimeMs })
    }

    if (totalSize <= maxSizeBytes) return

    files.sort((a, b) => a.mtime - b.mtime)
    for (const file of files) {
      if (totalSize <= maxSizeBytes) break
      await fsPromises
        .unlink(path.join(this.assetsDir, file.name))
        .catch(() => {})
      totalSize -= file.size
    }
  }

  clear(): void {
    if (fs.existsSync(this.assetsDir)) {
      fs.rmSync(this.assetsDir, { recursive: true, force: true })
    }
  }

  async flush() {
    await globalBackgroundQueue.flush()
  }
}
