import path from 'node:path'
import {
  parseFrontmatterAsync,
  capitalize,
  stripNumberPrefix,
  extractNumberPrefix,
  logSecurityEvent,
  sanitizeHtml,
} from '../../utils'
import { parseFrontmatterFast } from '../../utils/frontmatter'
import { MAX_PATH_LENGTH, ALLOWED_PATH_CHARS } from '../../security/constants'
import { EncodingSecurityError, PathTraversalError } from '../../errors'
import type { BoltdocsConfig } from '../../config'
import type { ParsedDocFile } from '../types'

// Typed view of the frontmatter payload. The parsers return
// `Record<string, unknown>` because YAML is structurally untyped; this
// view lets the rest of the parser reference known fields by name.
type FrontmatterData = {
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
  badge?: string | { text: string; expires?: string }  } & {
    // Escape hatch for user-defined frontmatter keys.
    [key: string]: unknown
  }

/** Compute the sidebar position for a group index page, preserving 0. */
function resolveGroupPosition(
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

import { resolveRoutePath, type PathResolution } from './resolver'
import { extractContentData } from './extractor'
import { processSeoData, sanitizeFrontmatterStrings } from './metadata'

import { ParserCache } from './cache'

export async function parseDocFile(
  file: string,
  docsDir: string,
  basePath: string,
  config?: BoltdocsConfig,
): Promise<ParsedDocFile> {
  const cached = await ParserCache.get(file)
  if (cached) return cached

  const normalizedFile = file.replace(/\\/g, '/')
  const normalizedDocsDir = docsDir.replace(/\\/g, '/')

  const decodedFile = validateFilePath(normalizedFile)
  let absoluteFile = path.resolve(decodedFile)
  let absoluteDocsDir = path.resolve(normalizedDocsDir)

  if (path.sep === '/') {
    const toPosix = (p: string) => {
      let resolved = p.replace(/\\/g, '/')
      if (/^[a-zA-Z]:/.test(resolved)) {
        resolved = resolved.replace(/^[a-zA-Z]:/, '')
      }
      return path.resolve(resolved)
    }
    absoluteFile = toPosix(decodedFile)
    absoluteDocsDir = toPosix(normalizedDocsDir)
  }

  const relativePathForSecurity = path
    .relative(absoluteDocsDir, absoluteFile)
    .replace(/\\/g, '/')
  if (
    relativePathForSecurity.startsWith('../') ||
    (relativePathForSecurity !== '.' &&
      !ALLOWED_PATH_CHARS.test(relativePathForSecurity))
  ) {
    throw new PathTraversalError(
      `Security breach: File is outside of docs directory, contains null bytes, or invalid path characters: ${path.basename(decodedFile)}`,
    )
  }

  const result = (await parseFrontmatterAsync(file)) as {
    data: FrontmatterData
    content: string
    rawMatter: string
  }
  const { data, content } = result

  const resolution = resolveRoutePath(
    absoluteFile,
    absoluteDocsDir,
    basePath,
    config,
    data.permalink,
  )

  let _lazyContentData: ReturnType<typeof extractContentData> | null = null
  const getContentData = () => {
    if (!_lazyContentData) {
      _lazyContentData = extractContentData(content, data.description)
    }
    return _lazyContentData
  }

  const sanitizedStrings = sanitizeFrontmatterStrings(data)
  const seo = processSeoData(data)

  const rawFileName = path.basename(resolution.relativePath)
  const cleanFileName = stripNumberPrefix(rawFileName)

  const cleanSlugParts = resolution.remainingParts.map((p) =>
    stripNumberPrefix(p),
  )
  const slugParts = cleanSlugParts.slice(0, -1)

  const isGroupIndex = /^index\.mdx?$/.test(cleanFileName)
  const sidebarPosition =
    data.sidebarPosition ?? extractNumberPrefix(rawFileName)

  const relativeDirString = slugParts.join('/')

  const parsed: ParsedDocFile = {
    route: {
      path: resolution.finalPath,
      componentPath: file,
      filePath: resolution.relativePath,
      title:
        sanitizedStrings.title ||
        stripNumberPrefix(
          path.basename(normalizedFile, path.extname(normalizedFile)),
        ),
      get description() {
        return getContentData().description
      },
      sidebarPosition,
      get headings() {
        return getContentData().headings
      },
      locale: resolution.locale,
      version: resolution.version,
      badge: sanitizedStrings.badge,
      icon: data.icon ? String(data.icon) : undefined,
      tab: resolution.inferredTab,
      subRouteGroup: resolution.subRouteGroup,
      slugParts,
      get _content() {
        return getContentData().plainText
      },
      _rawContent: content,
      date: data.date,
      lastUpdated: data.lastUpdated,
      category: data.category,
      order: data.order,
      sidebarLabel: data.sidebarLabel,
      sidebarHidden: data.sidebarHidden || data.hidden,
      seo,
      frontmatter: data,
      collection: resolution.collection,
      tags: data.tags,
      author: data.author,
      draft: data.draft,
      excerpt: data.excerpt,
      coverImage: data.coverImage || data.cover,
    },
    relativeDir: resolution.collection
      ? undefined
      : relativeDirString || undefined,
    isGroupIndex,
    inferredTab: resolution.inferredTab,
    inferredCollection: resolution.collection,
    groupMeta: isGroupIndex
      ? {
          title:
            data.groupTitle ||
            sanitizedStrings.title ||
            (slugParts.length > 0
              ? capitalize(slugParts[slugParts.length - 1])
              : ''),
          position: resolveGroupPosition(data, resolution),
          icon: data.icon ? String(data.icon) : undefined,
        }
      : undefined,
    inferredGroupPosition:
      resolution.remainingParts.length > 1
        ? extractNumberPrefix(
            resolution.remainingParts[resolution.remainingParts.length - 2],
          )
        : undefined,
  }

  await ParserCache.set(file, parsed)

  return parsed
}

function validateFilePath(file: string): string {
  let decoded: string
  try {
    decoded = decodeURIComponent(file)
  } catch (e) {
    logSecurityEvent('SECURITY_ERROR', 'Invalid encoding in path', { file })
    throw new EncodingSecurityError(
      `Security breach: Invalid characters or encoding in path`,
    )
  }

  if (decoded.length > MAX_PATH_LENGTH) {
    throw new PathTraversalError(`Path length exceeds limit`)
  }

  return decoded
}

export async function parseDocFileWithNative(
  file: string,
  nativeDoc: {
    rawMatter: string
    content: string
    headings: { level: number; text: string; id: string }[]
    plainText: string
    description: string
  },
  docsDir: string,
  basePath: string,
  config?: BoltdocsConfig,
): Promise<ParsedDocFile> {
  const normalizedFile = file.replace(/\\/g, '/')
  const normalizedDocsDir = docsDir.replace(/\\/g, '/')

  const decodedFile = validateFilePath(normalizedFile)
  let absoluteFile = path.resolve(decodedFile)
  let absoluteDocsDir = path.resolve(normalizedDocsDir)

  if (path.sep === '/') {
    const toPosix = (p: string) => {
      let resolved = p.replace(/\\/g, '/')
      if (/^[a-zA-Z]:/.test(resolved)) {
        resolved = resolved.replace(/^[a-zA-Z]:/, '')
      }
      return path.resolve(resolved)
    }
    absoluteFile = toPosix(decodedFile)
    absoluteDocsDir = toPosix(normalizedDocsDir)
  }

  const relativePathForSecurity = path
    .relative(absoluteDocsDir, absoluteFile)
    .replace(/\\/g, '/')
  if (
    relativePathForSecurity.startsWith('../') ||
    (relativePathForSecurity !== '.' &&
      !ALLOWED_PATH_CHARS.test(relativePathForSecurity))
  ) {
    throw new PathTraversalError(
      `Security breach: File is outside of docs directory, contains null bytes, or invalid path characters: ${path.basename(decodedFile)}`,
    )
  }

  // Parse frontmatter from the rawMatter provided by Zig
  const { data } = parseFrontmatterFast(
    '---\n' + nativeDoc.rawMatter + '\n---',
  ) as { data: FrontmatterData; content: string; rawMatter: string }

  const resolution = resolveRoutePath(
    absoluteFile,
    absoluteDocsDir,
    basePath,
    config,
    data.permalink,
  )

  const sanitizedStrings = sanitizeFrontmatterStrings(data)
  const seo = processSeoData(data)

  const rawFileName = path.basename(resolution.relativePath)
  const cleanFileName = stripNumberPrefix(rawFileName)

  const cleanSlugParts = resolution.remainingParts.map((p) =>
    stripNumberPrefix(p),
  )
  const slugParts = cleanSlugParts.slice(0, -1)

  const isGroupIndex = /^index\.mdx?$/.test(cleanFileName)
  const sidebarPosition =
    data.sidebarPosition ?? extractNumberPrefix(rawFileName)

  const relativeDirString = slugParts.join('/')      // If explicit description is in frontmatter, sanitize it; else use nativeDoc.description
      const description = data.description
    ? sanitizeHtml(String(data.description)).trim()
    : nativeDoc.description

  const parsed: ParsedDocFile = {
    route: {
      path: resolution.finalPath,
      componentPath: file,
      filePath: resolution.relativePath,
      title:
        sanitizedStrings.title ||
        stripNumberPrefix(
          path.basename(normalizedFile, path.extname(normalizedFile)),
        ),
      description,
      sidebarPosition,
      headings: nativeDoc.headings,
      locale: resolution.locale,
      version: resolution.version,
      badge: sanitizedStrings.badge,
      icon: data.icon ? String(data.icon) : undefined,
      tab: resolution.inferredTab,
      subRouteGroup: resolution.subRouteGroup,
      slugParts,
      _content: nativeDoc.plainText,
      _rawContent: nativeDoc.content,
      date: data.date,
      lastUpdated: data.lastUpdated,
      category: data.category,
      order: data.order,
      sidebarLabel: data.sidebarLabel,
      sidebarHidden: data.sidebarHidden || data.hidden,
      seo,
      frontmatter: data,
      collection: resolution.collection,
      tags: data.tags,
      author: data.author,
      draft: data.draft,
      excerpt: data.excerpt,
      coverImage: data.coverImage || data.cover,
    },
    relativeDir: resolution.collection
      ? undefined
      : relativeDirString || undefined,
    isGroupIndex,
    inferredTab: resolution.inferredTab,
    inferredCollection: resolution.collection,
    groupMeta: isGroupIndex
      ? {
          title:
            data.groupTitle ||
            sanitizedStrings.title ||
            (slugParts.length > 0
              ? capitalize(slugParts[slugParts.length - 1])
              : ''),
          position: resolveGroupPosition(data, resolution),
          icon: data.icon ? String(data.icon) : undefined,
        }
      : undefined,
    inferredGroupPosition:
      resolution.remainingParts.length > 1
        ? extractNumberPrefix(
            resolution.remainingParts[resolution.remainingParts.length - 2],
          )
        : undefined,
  }

  await ParserCache.set(file, parsed)

  return parsed
}
