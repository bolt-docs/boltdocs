import path from 'node:path'
import {
  capitalize,
  sanitizeHtml,
  stripNumberPrefix,
  extractNumberPrefix,
} from '../../utils'
import type { BoltdocsConfig } from '../../config'
import type { ParsedDocFile } from '../types'
import { resolveRoutePath } from './resolver'
import { processSeoData, sanitizeFrontmatterStrings } from './metadata'
import { ParserCache } from './cache'
import {
  resolveGroupPosition,
  resolveSecurePaths,
  type FrontmatterData,
} from './shared'

export interface NativeParsedDoc {
  rawMatter: string
  content: string
  headings: { level: number; text: string; id: string }[]
  plainText: string
  description: string
  frontmatter?: Record<string, unknown>
}

/**
 * Convert the Zig/NAPI parser payload into the domain RouteMeta shape.
 *
 * This module intentionally does not import the JavaScript content extractor.
 * The JS parser remains available as a lazy fallback in ./index.
 */
export async function parseDocFileWithNative(
  file: string,
  nativeDoc: NativeParsedDoc,
  docsDir: string,
  basePath: string,
  config?: BoltdocsConfig,
  parserCache?: ParserCache,
): Promise<ParsedDocFile> {
  const cache = parserCache ?? ParserCache
  const { normalizedFile, normalizedDocsDir } = resolveSecurePaths(
    file,
    docsDir,
  )
  const data = (nativeDoc.frontmatter ?? {}) as FrontmatterData
  const resolution = resolveRoutePath(
    path.resolve(normalizedFile),
    path.resolve(normalizedDocsDir),
    basePath,
    config,
    data.permalink,
  )
  const sanitizedStrings = sanitizeFrontmatterStrings(data)
  const seo = processSeoData(data)
  const rawFileName = path.basename(resolution.relativePath)
  const cleanFileName = stripNumberPrefix(rawFileName)
  const cleanSlugParts = resolution.remainingParts.map((part) =>
    stripNumberPrefix(part),
  )
  const slugParts = cleanSlugParts.slice(0, -1)
  const isGroupIndex = /^_?index\.mdx?$/.test(cleanFileName)
  const sidebarPosition =
    data.sidebarPosition ?? extractNumberPrefix(rawFileName)
  const relativeDirString = slugParts.join('/')
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
      author: typeof data.author === 'string' ? data.author : data.author?.name,
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

  await cache.set(file, parsed)
  return parsed
}
