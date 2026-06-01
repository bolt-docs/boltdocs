import path from 'node:path'
import fs from 'node:fs'
import { colors, info } from '@bdocs/dui'
import { normalizePath, FrontmatterSchema } from '../../utils'
import type { DoctorContext, DoctorIssue } from './types'
import {
  getSeverity,
  getFileData,
  cachedExists,
  fileCache,
  parseBudget,
} from './utils'
import { getCachedSimilarity } from './similarity'

// Check for frontmatter and SEO metadata issues
export async function checkMetadata(
  ctx: DoctorContext,
): Promise<DoctorIssue[]> {
  const issues: DoctorIssue[] = []
  if (!ctx.doctorConfig.checks.metadata.enabled) return issues

  const { titleMin, titleMax, descriptionMin } =
    ctx.doctorConfig.checks.metadata
  const titleIndex = new Map<string, string[]>()

  for (const file of ctx.files) {
    const relPath = normalizePath(path.relative(ctx.docsDir, file))

    try {
      const { raw, data } = await getFileData(file)

      if (raw.trim().startsWith('---')) {
        const parts = raw.split('---')
        if (parts.length >= 3 && Object.keys(data).length === 0) {
          const level = getSeverity(ctx, 'malformedFrontmatter', 'high')
          if (level !== 'off') {
            issues.push({
              file: relPath,
              level,
              message: 'Malformed frontmatter (YAML parsing failed).',
              suggestion:
                'Check your YAML syntax for indentation or unquoted special characters.',
            })
          }
        }
      }

      const validation = FrontmatterSchema.safeParse(data)
      if (!validation.success) {
        const level = getSeverity(ctx, 'invalidFrontmatter', 'high')
        if (level !== 'off') {
          for (const error of validation.error.issues) {
            issues.push({
              file: relPath,
              level,
              message: `Invalid frontmatter field "${error.path.join('.')}": ${error.message}`,
              suggestion: 'Ensure the field follows the correct type.',
            })
          }
        }
      }

      const requiredFields = Array.from(
        new Set(['title', ...ctx.doctorConfig.checks.metadata.required]),
      )
      for (const field of requiredFields) {
        if (data[field] === undefined) {
          const level = getSeverity(ctx, 'missingMetadata', 'warning')
          if (level !== 'off') {
            issues.push({
              file: relPath,
              level,
              message: `Missing required frontmatter field: "${field}".`,
              suggestion: `Add the "${field}" field to your frontmatter.`,
            })
          }
        }
      }

      if (ctx.doctorConfig.checks.metadata.validateDates) {
        const dateFields = [
          'date',
          'lastUpdated',
          ...ctx.doctorConfig.checks.metadata.optional.filter((f: string) =>
            f.toLowerCase().includes('date'),
          ),
        ]
        for (const field of dateFields) {
          if (data[field] && Number.isNaN(Date.parse(String(data[field])))) {
            const level = getSeverity(ctx, 'invalidFrontmatter', 'high')
            if (level !== 'off') {
              issues.push({
                file: relPath,
                level,
                message: `Invalid date format in field "${field}": "${data[field]}".`,
                suggestion: 'Use a valid ISO date format (e.g., YYYY-MM-DD).',
              })
            }
          }
        }
      }

      if (data.title) {
        const title = String(data.title)
        if (title.length < titleMin) {
          const level = getSeverity(ctx, 'shortMetadata', 'low')
          if (level !== 'off') {
            issues.push({
              file: relPath,
              level,
              message: `Title is too short (${title.length} chars).`,
              suggestion: `Titles should be at least ${titleMin} characters for better SEO.`,
            })
          }
        } else if (title.length > titleMax) {
          const level = getSeverity(ctx, 'shortMetadata', 'low')
          if (level !== 'off') {
            issues.push({
              file: relPath,
              level,
              message: `Title is too long (${title.length} chars).`,
              suggestion: `Titles should be under ${titleMax} characters.`,
            })
          }
        }

        const existing = titleIndex.get(title) || []
        existing.push(relPath)
        titleIndex.set(title, existing)
      }

      if (data.description) {
        const desc = String(data.description)
        if (desc.length < descriptionMin) {
          const level = getSeverity(ctx, 'shortMetadata', 'low')
          if (level !== 'off') {
            issues.push({
              file: relPath,
              level,
              message: 'Description is very short.',
              suggestion: `Descriptions should ideally be at least ${descriptionMin} characters.`,
            })
          }
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error) {
        const level = getSeverity(ctx, 'malformedFrontmatter', 'high')
        if (level !== 'off') {
          issues.push({
            file: relPath,
            level,
            message: `Malformed frontmatter (YAML error): ${e.message}`,
            suggestion:
              'Check your YAML syntax for indentation or unquoted special characters.',
          })
        }
      }
    }
  }

  for (const [title, files] of titleIndex.entries()) {
    if (files.length > 1) {
      const level = getSeverity(ctx, 'duplicateTitle', 'low')
      if (level !== 'off') {
        for (const file of files) {
          issues.push({
            file,
            level,
            message: `Duplicate title found: "${title}"`,
            suggestion: `Ensure each page has a unique title. Also used in: ${files.filter((f) => f !== file).join(', ')}`,
          })
        }
      }
    }
  }

  return issues
}

// Check for broken internal and optionally external links
export async function checkLinks(ctx: DoctorContext): Promise<DoctorIssue[]> {
  const issues: DoctorIssue[] = []
  const {
    internal,
    external,
    ignore,
    timeout: linkTimeout,
    concurrency,
  } = ctx.doctorConfig.checks.links

  if (!internal && !external && !ctx.options.checkExternal) return issues

  const combinedRegex = /(?:\[.*?\]\((.*?)\))|(?:href=["']([^"']+)["'])/g
  const externalLinks = new Set<{ url: string; file: string }>()
  const MAX_SCAN_SIZE = 500_000

  for (const file of ctx.files) {
    const relPath = normalizePath(path.relative(ctx.docsDir, file))
    const { content } = await getFileData(file)

    const scanContent =
      content.length > MAX_SCAN_SIZE ? content.slice(0, MAX_SCAN_SIZE) : content

    const cleanedContent = scanContent
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`\n]*`/g, '')

    const matches = [...cleanedContent.matchAll(combinedRegex)]

    for (const match of matches) {
      const originalLink = match[1] || match[2]
      const isMarkdown = !!match[1]
      if (!originalLink) continue

      if (ignore.some((i) => originalLink.includes(i))) continue

      if (/^https?:\/\//i.test(originalLink)) {
        if (external || ctx.options.checkExternal) {
          externalLinks.add({ url: originalLink, file })
        }
        continue
      }

      if (!internal) continue
      if (/^(mailto|tel|#)/i.test(originalLink)) continue

      let link: string
      try {
        link = decodeURIComponent(originalLink.split('#')[0].split('?')[0])
      } catch {
        link = originalLink.split('#')[0].split('?')[0]
      }

      if (!link) continue

      let targetExists = false
      let resolvedInternalPath = ''

      if (link.startsWith('/')) {
        if (
          ctx.routeIndex.has(link) ||
          ctx.routeIndexWithSlash.has(link) ||
          ctx.routeIndexWithoutSlash.has(link)
        ) {
          targetExists = true
        } else {
          const linkWithBase =
            ctx.basePrefix + (link.startsWith('/') ? link : '/' + link)
          if (
            ctx.routeIndex.has(linkWithBase) ||
            ctx.routeIndexWithSlash.has(linkWithBase)
          ) {
            targetExists = false
            resolvedInternalPath = linkWithBase
          } else {
            const pathAfterBase =
              ctx.config.base !== '/' && link.startsWith(ctx.config.base || '/')
                ? link.substring((ctx.config.base || '/').length)
                : link

            const cleanPathAfterBase = pathAfterBase.startsWith('/')
              ? pathAfterBase.substring(1)
              : pathAfterBase
            resolvedInternalPath = path.join(ctx.docsDir, cleanPathAfterBase)
            const extensions = ['', '.md', '.mdx', '/index.md', '/index.mdx']
            targetExists = extensions.some((ext) =>
              cachedExists(resolvedInternalPath + ext),
            )
          }
        }
      } else {
        resolvedInternalPath = path.resolve(path.dirname(file), link)
        const extensions = ['', '.md', '.mdx', '/index.md', '/index.mdx']
        targetExists = extensions.some((ext) =>
          cachedExists(resolvedInternalPath + ext),
        )
      }

      if (!targetExists) {
        let { bestMatch, similarity: maxSimilarity } = getCachedSimilarity(
          link,
          ctx.linkTree.routes,
        )

        let detectedBaseMissing = false
        const linkWithBase =
          ctx.basePrefix + (link.startsWith('/') ? link : '/' + link)
        if (
          ctx.routeIndex.has(linkWithBase) ||
          ctx.routeIndexWithSlash.has(linkWithBase)
        ) {
          bestMatch = linkWithBase
          maxSimilarity = 1.0
          detectedBaseMissing = true
        }

        const showSuggestion = maxSimilarity > 0.6 || detectedBaseMissing
        const isConfident =
          (maxSimilarity > 0.75 && bestMatch !== link) || detectedBaseMissing
        const level = getSeverity(ctx, 'brokenLink', 'high')
        if (level !== 'off') {
          issues.push({
            file: relPath,
            level,
            message: `Broken internal link: "${originalLink}"`,
            suggestion: showSuggestion
              ? `Did you mean "${bestMatch}"?`
              : `Ensure the target exists or check for typos.`,
            fix: isConfident
              ? async () => {
                  const anchor = originalLink.includes('#')
                    ? '#' + originalLink.split('#')[1]
                    : ''
                  const targetToReplace = isMarkdown
                    ? `(${originalLink})`
                    : `href="${originalLink}"`
                  const replacement = isMarkdown
                    ? `(${bestMatch}${anchor})`
                    : `href="${bestMatch}${anchor}"`

                  const currentRaw = fs.readFileSync(file, 'utf-8')
                  const fixedContent = currentRaw.replace(
                    targetToReplace,
                    replacement,
                  )
                  fs.writeFileSync(file, fixedContent)
                  fileCache.delete(file)
                }
              : undefined,
          })
        }
      }
    }
  }

  if (externalLinks.size > 0) {
    info(colors.gray(`Verifying ${externalLinks.size} external links...`))
    const urlToFile = new Map<string, string[]>()
    for (const item of externalLinks) {
      if (!urlToFile.has(item.url)) urlToFile.set(item.url, [])
      urlToFile.get(item.url)!.push(item.file)
    }

    const checkUrl = async (
      url: string,
    ): Promise<{ url: string; ok: boolean; error?: string }> => {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), linkTimeout)
        const res = await fetch(url, {
          method: 'HEAD',
          signal: controller.signal,
          headers: { 'User-Agent': 'boltdocs-doctor/1.0' },
        })
        clearTimeout(timeout)

        if (!res.ok && res.status !== 404) {
          const resGet = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            headers: { 'User-Agent': 'boltdocs-doctor/1.0' },
          })
          return { url, ok: resGet.ok }
        }
        return { url, ok: res.ok }
      } catch (e: any) {
        return { url, ok: false, error: e.message }
      }
    }

    const urls = Array.from(urlToFile.keys())
    const results: any[] = []
    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency)
      const batchResults = await Promise.allSettled(batch.map(checkUrl))
      results.push(
        ...batchResults.map((r) =>
          r.status === 'fulfilled'
            ? (r as any).value
            : {
                url: 'unknown',
                ok: false,
                error: (r as PromiseRejectedResult).reason,
              },
        ),
      )
    }

    for (const res of results) {
      if (!res.ok) {
        const level = getSeverity(ctx, 'brokenLink', 'warning')
        if (level !== 'off') {
          const files = urlToFile.get(res.url) || []
          for (const file of files) {
            issues.push({
              file: normalizePath(path.relative(ctx.docsDir, file)),
              level,
              message: `Broken external link: "${res.url}"`,
              suggestion: `Verify the URL or update it if it's permanently down. Error: ${res.error || 'Status >= 400'}`,
            })
          }
        }
      }
    }
  }

  return issues
}

// Check i18n issues
export async function checkI18n(ctx: DoctorContext): Promise<DoctorIssue[]> {
  const issues: DoctorIssue[] = []
  if (!ctx.doctorConfig.checks.i18n.enabled || !ctx.config.i18n) return issues

  const { defaultLocale, locales } = ctx.config.i18n
  const allLocales = Object.keys(locales)
  const otherLocales = allLocales.filter((l) => l !== defaultLocale)

  for (const file of ctx.files) {
    const relPath = normalizePath(path.relative(ctx.docsDir, file))
    const parts = relPath.split('/')
    const locale = parts[0]

    if (locale === defaultLocale) {
      const pathAfterLocale = parts.slice(1).join('/')
      for (const targetLocale of otherLocales) {
        const targetPath = path.join(ctx.docsDir, targetLocale, pathAfterLocale)
        if (!cachedExists(targetPath)) {
          const level = getSeverity(ctx, 'missingTranslation', 'warning')
          if (level !== 'off') {
            issues.push({
              file: relPath,
              level,
              message: `Missing translation for locale "${targetLocale}"`,
              suggestion: `Create a version at "${targetLocale}/${pathAfterLocale}".`,
              fix: async () => {
                const targetDir = path.dirname(targetPath)
                if (!fs.existsSync(targetDir))
                  fs.mkdirSync(targetDir, { recursive: true })
                fs.copyFileSync(file, targetPath)
              },
            })
          }
        }
      }
    } else if (allLocales.includes(locale)) {
      const pathAfterLocale = parts.slice(1).join('/')
      const sourcePath = path.join(ctx.docsDir, defaultLocale, pathAfterLocale)
      if (!cachedExists(sourcePath)) {
        const level = getSeverity(ctx, 'missingTranslation', 'low')
        if (level !== 'off') {
          issues.push({
            file: relPath,
            level,
            message: `Orphaned translation (source missing in "${defaultLocale}")`,
            suggestion: `Remove this file or create the source at "${defaultLocale}/${pathAfterLocale}".`,
            fix: async () => {
              fs.unlinkSync(file)
            },
          })
        }
      }
    }
  }
  return issues
}

// Check sidebar configuration for broken links and orphaned pages
export async function checkSidebar(ctx: DoctorContext): Promise<DoctorIssue[]> {
  const issues: DoctorIssue[] = []
  if (!ctx.config.theme.sidebar) return issues

  const linkedRoutes = new Set<string>()
  const sidebar = ctx.config.theme.sidebar

  for (const [group, items] of Object.entries(sidebar)) {
    for (const item of items as { text: string; link: string }[]) {
      if (!item.text) {
        const level = getSeverity(ctx, 'invalidFrontmatter', 'warning')
        if (level !== 'off') {
          issues.push({
            file: 'boltdocs.config.ts',
            level,
            message: `Sidebar item in group "${group}" is missing a label.`,
            suggestion: 'Add a "text" property to the sidebar item.',
          })
        }
      }

      if (item.link) {
        linkedRoutes.add(item.link)
        if (!ctx.routeIndex.has(item.link)) {
          const { bestMatch, similarity: maxSimilarity } = getCachedSimilarity(
            item.link,
            ctx.linkTree.routes,
          )
          const showSuggestion = maxSimilarity > 0.6
          const level = getSeverity(ctx, 'brokenLink', 'high')
          if (level !== 'off') {
            issues.push({
              file: 'boltdocs.config.ts',
              level,
              message: `Broken sidebar link: "${item.link}"`,
              suggestion: showSuggestion
                ? `Did you mean "${bestMatch}"?`
                : 'Ensure the route exists and is correctly formatted.',
            })
          }
        }
      }
    }
  }

  for (const route of ctx.linkTree.routes) {
    if (route === '/' || route === '') continue
    if (!linkedRoutes.has(route)) {
      const level = getSeverity(ctx, 'orphanedPage', 'low')
      if (level !== 'off') {
        issues.push({
          file: 'Sidebar',
          level,
          message: `Orphaned page found: "${route}" is not linked in the sidebar.`,
          suggestion:
            'Consider adding it to the sidebar for better discoverability.',
        })
      }
    }
  }

  return issues
}

interface PerfMetrics {
  buildTime: number
  totalJSBundleSize: number
  totalCSSBundleSize: number
  totalImagesSize: number
  fontCount: number
  pages: Array<{ route: string; htmlSize: number }>
}

/**
 * Check build performance metrics against configured budgets.
 */
export async function checkPerformance(
  ctx: DoctorContext,
): Promise<DoctorIssue[]> {
  const issues: DoctorIssue[] = []
  const perfConfig = ctx.doctorConfig.checks.performance
  if (!perfConfig?.enabled) return issues

  const metricsPath = path.resolve(
    ctx.root,
    '.boltdocs',
    'reports',
    'performance.json',
  )
  if (!fs.existsSync(metricsPath)) {
    issues.push({
      file: '(build)',
      level: getSeverity(ctx, 'budgetExceeded', 'warning'),
      message: 'Performance metrics not found. Run `boltdocs build` first.',
    })
    return issues
  }

  let metrics: PerfMetrics
  try {
    metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf-8'))
  } catch {
    issues.push({
      file: '(build)',
      level: getSeverity(ctx, 'budgetExceeded', 'warning'),
      message: 'Failed to parse performance metrics file.',
    })
    return issues
  }

  const budgets = perfConfig.budgets
  const level = getSeverity(ctx, 'budgetExceeded', 'warning')

  const jsLimit = parseBudget(budgets?.maxJSBundleSize, Infinity)
  const cssLimit = parseBudget(budgets?.maxCSSBundleSize, Infinity)
  const htmlLimit = parseBudget(budgets?.maxPageHTMLSize, Infinity)
  const imageLimitKB = budgets?.maxImagesKB ?? Infinity
  const buildTimeLimit = budgets?.maxBuildTime ?? Infinity
  const fontLimit = budgets?.maxFontCount ?? Infinity

  if (jsLimit !== Infinity && metrics.totalJSBundleSize > jsLimit) {
    const actual = (metrics.totalJSBundleSize / 1024).toFixed(0)
    const expected = (jsLimit / 1024).toFixed(0)
    issues.push({
      file: '(build)',
      level,
      message: `JS bundle size exceeds budget: ${actual}kb > ${expected}kb`,
      suggestion:
        'Code-split large dependencies or lazy-load route components.',
    })
  }

  if (cssLimit !== Infinity && metrics.totalCSSBundleSize > cssLimit) {
    const actual = (metrics.totalCSSBundleSize / 1024).toFixed(0)
    const expected = (cssLimit / 1024).toFixed(0)
    issues.push({
      file: '(build)',
      level,
      message: `CSS bundle size exceeds budget: ${actual}kb > ${expected}kb`,
      suggestion: 'Remove unused styles or split CSS by route.',
    })
  }

  if (htmlLimit !== Infinity) {
    for (const page of metrics.pages) {
      if (page.htmlSize > htmlLimit) {
        const actual = (page.htmlSize / 1024).toFixed(0)
        const expected = (htmlLimit / 1024).toFixed(0)
        issues.push({
          file: page.route,
          level,
          message: `Page HTML size exceeds budget: ${actual}kb > ${expected}kb`,
          suggestion:
            'Reduce the amount of inline content or split into sub-pages.',
        })
      }
    }
  }

  const imageBytesLimitKB = imageLimitKB * 1024
  if (
    imageLimitKB !== Infinity &&
    metrics.totalImagesSize > imageBytesLimitKB
  ) {
    const actual = (metrics.totalImagesSize / 1024).toFixed(0)
    issues.push({
      file: '(build)',
      level,
      message: `Image assets exceed budget: ${actual}kb > ${imageLimitKB}kb`,
      suggestion:
        'Optimize images with lossy compression or use next-gen formats (webp/avif).',
    })
  }

  if (buildTimeLimit !== Infinity && metrics.buildTime > buildTimeLimit) {
    const actual = (metrics.buildTime / 1000).toFixed(1)
    const expected = (buildTimeLimit / 1000).toFixed(1)
    issues.push({
      file: '(build)',
      level,
      message: `Build time exceeds budget: ${actual}s > ${expected}s`,
      suggestion:
        'Check for large unoptimized assets or increase `concurrency` in SSG options.',
    })
  }

  if (fontLimit !== Infinity && metrics.fontCount > fontLimit) {
    issues.push({
      file: '(build)',
      level,
      message: `Font files exceed budget: ${metrics.fontCount} > ${fontLimit}`,
      suggestion: 'Reduce the number of font families or use variable fonts.',
    })
  }

  return issues
}
