import path from 'node:path'
import {
  parseFrontmatterAsync,
  capitalize,
  stripNumberPrefix,
  extractNumberPrefix,
} from '../../utils'
import type { BoltdocsConfig } from '../../config'
import type { ParsedDocFile } from '../types'
import { resolveRoutePath } from './resolver'
import { extractContentData } from './extractor'
import { processSeoData, sanitizeFrontmatterStrings } from './metadata'
import { ParserCache } from './cache'
import {
  resolveGroupPosition,
  resolveSecurePaths,
  type FrontmatterData,
} from './shared'

// The JavaScript parser is a compatibility fallback. The normal route path
// uses @bdocs/parser (Zig/NAPI/native/WASM) and parser/native.ts instead.
export { parseDocFileWithNative } from './native'

export async function parseDocFile(
  file: string,
  docsDir: string,
  basePath: string,
  config?: BoltdocsConfig,
  parserCache?: ParserCache,
): Promise<ParsedDocFile> {
  const cache = parserCache ?? ParserCache
  const cached = await cache.get(file)
  if (cached) return cached

  const { normalizedFile, normalizedDocsDir } = resolveSecurePaths(
    file,
    docsDir,
  )
  const absoluteFile = path.resolve(normalizedFile)
  const absoluteDocsDir = path.resolve(normalizedDocsDir)
  const result = (await parseFrontmatterAsync(file)) as unknown as {
    data: FrontmatterData
    content: string
  }
  const { data, content } = result

  const resolution = resolveRoutePath(
    absoluteFile,
    absoluteDocsDir,
    basePath,
    config,
    data.permalink,
  )

  let contentData: ReturnType<typeof extractContentData> | null = null
  const getContentData = () => {
    if (!contentData) {
      contentData = extractContentData(content, data.description)
    }
    return contentData
  }

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
