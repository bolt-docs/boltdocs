import { dirname } from 'node:path'
import fs from 'fs-extra'

export interface MaterializeFile {
  source: string
  destination: string
}

/**
 * Materialize an immutable cache file without ever writing through an existing
 * hardlink. Removing the destination first gives the new output its own inode
 * before the EXDEV/EPERM copy fallback runs.
 */
export async function linkOrCopyFile(
  source: string,
  destination: string,
): Promise<void> {
  if (source === destination) return

  await fs.ensureDir(dirname(destination))
  await fs.remove(destination)

  try {
    await fs.link(source, destination)
  } catch {
    // Hardlinks are unavailable across devices and on some Windows filesystems.
    await fs.copy(source, destination)
  }
}

/**
 * Materialize a batch while reserving destinations synchronously. Duplicate
 * aliases therefore share one operation instead of racing to replace an inode.
 */
export async function materializeFiles(
  files: readonly MaterializeFile[],
): Promise<void> {
  const reserved = new Set<string>()
  const operations: Promise<void>[] = []

  for (const file of files) {
    if (reserved.has(file.destination)) continue
    reserved.add(file.destination)
    operations.push(linkOrCopyFile(file.source, file.destination))
  }

  await Promise.all(operations)
}
