import crypto from 'node:crypto'
import { parseFrontmatterAsync } from '../utils'
import { docCache } from '../routes/cache'

const frontmatterHashes = new Map<string, string>()

function hashFrontmatterData(data: Record<string, unknown>): string {
  const { lastUpdated: _, ...rest } = data
  return crypto.createHash('md5').update(JSON.stringify(rest)).digest('hex')
}

export async function computeFrontmatterHash(
  filePath: string,
): Promise<string> {
  try {
    const { data } = await parseFrontmatterAsync(filePath)
    return hashFrontmatterData(data)
  } catch {
    return ''
  }
}

export function getFrontmatterHash(filePath: string): string | undefined {
  let hash = frontmatterHashes.get(filePath)
  if (hash === undefined) {
    const cachedDoc = docCache.getStale(filePath)
    if (cachedDoc?.route?.frontmatter) {
      hash = hashFrontmatterData(cachedDoc.route.frontmatter)
      frontmatterHashes.set(filePath, hash)
    }
  }
  return hash
}

export function setFrontmatterHash(filePath: string, hash: string): void {
  frontmatterHashes.set(filePath, hash)
}

export function removeFrontmatterHash(filePath: string): void {
  frontmatterHashes.delete(filePath)
}
