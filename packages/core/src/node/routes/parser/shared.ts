import path from 'node:path'
import { extractNumberPrefix, logSecurityEvent } from '../../utils'
import { MAX_PATH_LENGTH, ALLOWED_PATH_CHARS } from '../../security/constants'
import { EncodingSecurityError, PathTraversalError } from '../../errors'
import type { PathResolution } from './resolver'

export type FrontmatterData = {
  permalink?: string
  title?: string
  description?: string
  sidebarPosition?: number
  date?: string | Date
  icon?: string
  lastUpdated?: string | number | Date
  category?: string
  order?: number
  sidebarLabel?: string
  sidebarHidden?: boolean
  hidden?: boolean
  seo?: Record<string, unknown>
  tags?: string[]
  author?:
    | string
    | { name: string; avatar?: string; url?: string; image?: string }
  draft?: boolean
  excerpt?: string
  coverImage?: string
  cover?: string
  groupTitle?: string
  groupPosition?: number
  badge?: string | { text: string; expires?: string }
  [key: string]: unknown
}

export function resolveGroupPosition(
  data: FrontmatterData,
  resolution: PathResolution,
): number | undefined {
  if (data.groupPosition !== undefined) return data.groupPosition
  if (data.sidebarPosition !== undefined) return data.sidebarPosition
  if (resolution.remainingParts.length <= 1) return undefined
  const prefix = extractNumberPrefix(
    resolution.remainingParts[resolution.remainingParts.length - 2],
  )
  return prefix === undefined ? undefined : Number(prefix)
}

export function validateFilePath(file: string): string {
  let decoded: string
  try {
    decoded = decodeURIComponent(file)
  } catch {
    logSecurityEvent('SECURITY_ERROR', 'Invalid encoding in path', { file })
    throw new EncodingSecurityError(
      'Security breach: Invalid characters or encoding in path',
    )
  }

  if (decoded.length > MAX_PATH_LENGTH) {
    throw new PathTraversalError('Path length exceeds limit')
  }

  return decoded
}

export function resolveSecurePaths(
  file: string,
  docsDir: string,
): { normalizedFile: string; normalizedDocsDir: string; relativePath: string } {
  const normalizedFile = file.replace(/\\/g, '/')
  const normalizedDocsDir = docsDir.replace(/\\/g, '/')
  const decodedFile = validateFilePath(normalizedFile)
  let absoluteFile = path.resolve(decodedFile)
  let absoluteDocsDir = path.resolve(normalizedDocsDir)

  if (path.sep === '/') {
    const toPosix = (value: string) => {
      let resolved = value.replace(/\\/g, '/')
      if (/^[a-zA-Z]:/.test(resolved)) {
        resolved = resolved.replace(/^[a-zA-Z]:/, '')
      }
      return path.resolve(resolved)
    }
    absoluteFile = toPosix(decodedFile)
    absoluteDocsDir = toPosix(normalizedDocsDir)
  }

  const relativePath = path
    .relative(absoluteDocsDir, absoluteFile)
    .replace(/\\/g, '/')
  if (
    relativePath.startsWith('../') ||
    (relativePath !== '.' && !ALLOWED_PATH_CHARS.test(relativePath))
  ) {
    throw new PathTraversalError(
      `Security breach: File is outside of docs directory, contains null bytes, or invalid path characters: ${path.basename(decodedFile)}`,
    )
  }

  return { normalizedFile, normalizedDocsDir, relativePath }
}
