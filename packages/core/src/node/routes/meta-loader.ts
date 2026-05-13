import fs from 'node:fs/promises'
import path from 'node:path'
import { fdir } from 'fdir'

export interface DirectoryMeta {
  title?: string
  order?: string[] | number
  icon?: string
  collapsible?: boolean
  collapsed?: boolean
  [key: string]: any
}

export async function loadDirectoryMeta(
  docsDir: string,
): Promise<Record<string, DirectoryMeta>> {
  const results: Record<string, DirectoryMeta> = {}

  try {
    const files = await new fdir()
      .withFullPaths()
      .filter((p) => p.endsWith('meta.json'))
      .crawl(docsDir)
      .withPromise()

    // Filter to only the valid basenames first, then read all files in parallel
    // instead of sequentially with blocking readFileSync.
    const validFiles = files.filter((file) => {
      const baseName = path.basename(file)
      return baseName === 'meta.json' || baseName === '_meta.json'
    })

    const reads = await Promise.allSettled(
      validFiles.map(async (file) => {
        const raw = await fs.readFile(file, 'utf-8')
        const relDir = path
          .relative(docsDir, path.dirname(file))
          .replace(/\\/g, '/')
        const normalizedKey = relDir === '' ? '.' : relDir
        return { key: normalizedKey, content: JSON.parse(raw) }
      }),
    )

    for (const settled of reads) {
      if (settled.status === 'fulfilled') {
        results[settled.value.key] = settled.value.content
      } else {
        console.warn('[Boltdocs] Failed to read meta.json:', settled.reason)
      }
    }
  } catch (e) {
    console.error('[Boltdocs] Error loading directory metadata:', e)
  }

  return results
}
