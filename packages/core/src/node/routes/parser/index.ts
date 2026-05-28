import path from 'node:path'
import {
  parseFrontmatterAsync,
  capitalize,
  stripNumberPrefix,
  extractNumberPrefix,
  logSecurityEvent,
} from '../../utils'
import { MAX_PATH_LENGTH, ALLOWED_PATH_CHARS } from '../../security/constants'
import { EncodingSecurityError, PathTraversalError } from '../../errors'
import type { BoltdocsConfig } from '../../config'
import type { ParsedDocFile } from '../types'

import { resolveRoutePath } from './resolver'
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

  const { data, content } = await parseFrontmatterAsync(file)

  const resolution = resolveRoutePath(
    absoluteFile,
    absoluteDocsDir,
    basePath,
    config,
    data.permalink,
  )

  const contentData = extractContentData(content, data.description)

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
      description: contentData.description,
      sidebarPosition,
      headings: contentData.headings,
      locale: resolution.locale,
      version: resolution.version,
      badge: sanitizedStrings.badge,
      icon: data.icon ? String(data.icon) : undefined,
      tab: resolution.inferredTab,
      subRouteGroup: resolution.subRouteGroup,
      slugParts, // EXPOSE THE NEW SEGMENTS
      _content: contentData.plainText,
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
      coverImage: data.coverImage,
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
          position:
            data.groupPosition ??
            data.sidebarPosition ??
            (resolution.remainingParts.length > 1
              ? extractNumberPrefix(
                  resolution.remainingParts[
                    resolution.remainingParts.length - 2
                  ],
                )
              : undefined),
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
