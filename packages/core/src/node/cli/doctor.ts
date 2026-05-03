import path from 'path'
import fs from 'fs'
import fastGlob from 'fast-glob'
import { resolveConfig, type BoltdocsConfig } from '../config'
import { parseFrontmatter, normalizePath, fileToRoutePath, FrontmatterSchema } from '../utils'
import * as ui from './ui'

/**
 * Interface for the Link Tree stored in .boltdocs/link-tree.json
 */
export interface LinkTree {
  routes: string[]
  timestamp: number
}

/**
 * Configuration for the doctor command.
 */
import { type DoctorConfig } from './doctor-config'
export type { DoctorConfig }

export const DEFAULT_DOCTOR_CONFIG: DoctorConfig = {
  $schema: 'https://boltdocs.dev/schemas/doctor-config.schema.json',
  checks: {
    metadata: {
      enabled: true,
      titleMin: 10,
      titleMax: 60,
      descriptionMin: 50,
      required: ['title', 'description'],
      optional: [],
      validateDates: false
    },
    links: {
      internal: true,
      external: false,
      timeout: 10000,
      concurrency: 10,
      ignore: []
    },
    i18n: {
      enabled: true
    }
  },
  fix: {
    confirmChanges: false,
    backupFiles: false,
    backupPath: '.boltdocs/backups'
  },
  reporting: {
    format: 'pretty',
    outputFile: '.boltdocs/doctor-report.json',
    failOnError: false,
    maxWarnings: -1 // -1 means no limit
  },
  severity: {
    missingTranslation: 'warning',
    brokenLink: 'high',
    brokenAnchor: 'warning',
    largeFile: 'warning',
    orphanedPage: 'low',
    duplicateTitle: 'low',
    shortMetadata: 'low',
    missingMetadata: 'warning',
    malformedFrontmatter: 'high',
    invalidFrontmatter: 'high'
  },
  exclude: []
}

function getSeverity(ctx: DoctorContext, type: string, defaultLevel: 'high' | 'warning' | 'low'): 'high' | 'warning' | 'low' | 'off' {
  return ctx.doctorConfig.severity[type] || defaultLevel
}

async function backupFile(filePath: string, backupDir: string) {
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true })
  const fileName = path.basename(filePath)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = path.join(backupDir, `${fileName}.${timestamp}.bak`)
  fs.copyFileSync(filePath, backupPath)
}

// CACHE DE CONTENIDO: Lee cada archivo UNA SOLA VEZ
const fileCache = new Map<string, Promise<{ raw: string; data: Record<string, any>; content: string }>>()

function getFileData(filePath: string): Promise<{ raw: string; data: Record<string, any>; content: string }> {
  const cached = fileCache.get(filePath)
  if (cached) return cached
  
  const promise = (async () => {
    const parsed = parseFrontmatter(filePath, false)
    return { raw: parsed.raw, data: parsed.data, content: parsed.content }
  })()
  
  fileCache.set(filePath, promise)
  return promise
}

// CACHE DE EXISTENCIA DE ARCHIVOS: Evita repetir statSync
const fileExistsCache = new Map<string, boolean>()

function cachedExists(filePath: string): boolean {
  if (fileExistsCache.has(filePath)) return fileExistsCache.get(filePath)!
  let exists = false
  try {
    exists = fs.existsSync(filePath) && fs.statSync(filePath).isFile()
  } catch {
    exists = false
  }
  fileExistsCache.set(filePath, exists)
  return exists
}

async function loadDoctorConfig(root: string): Promise<DoctorConfig> {
  const configPath = path.resolve(root, 'doctor.json')
  if (fs.existsSync(configPath)) {
    try {
      const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      return {
        ...DEFAULT_DOCTOR_CONFIG,
        ...userConfig,
        checks: {
          ...DEFAULT_DOCTOR_CONFIG.checks,
          ...userConfig.checks,
          metadata: { ...DEFAULT_DOCTOR_CONFIG.checks.metadata, ...userConfig.checks?.metadata },
          links: { ...DEFAULT_DOCTOR_CONFIG.checks.links, ...userConfig.checks?.links },
          i18n: { ...DEFAULT_DOCTOR_CONFIG.checks.i18n, ...userConfig.checks?.i18n },
        },
        fix: { ...DEFAULT_DOCTOR_CONFIG.fix, ...userConfig.fix },
        reporting: { ...DEFAULT_DOCTOR_CONFIG.reporting, ...userConfig.reporting },
        severity: { ...DEFAULT_DOCTOR_CONFIG.severity, ...userConfig.severity },
        exclude: [...DEFAULT_DOCTOR_CONFIG.exclude, ...(userConfig.exclude || [])]
      }
    } catch (e) {
      ui.warn(`Failed to parse doctor.json: ${e}`)
    }
  }
  return DEFAULT_DOCTOR_CONFIG
}

/**
 * Context object shared across doctor actions.
 */
export interface DoctorContext {
  root: string
  docsDir: string
  config: BoltdocsConfig
  doctorConfig: DoctorConfig
  linkTree: LinkTree
  files: string[]
  options: { fix?: boolean; checkExternal?: boolean }
  // Optimized lookups
  routeIndex: Set<string>
  routeIndexWithSlash: Set<string>
  routeIndexWithoutSlash: Set<string>
  basePrefix: string
}

/**
 * Represents a documentation issue found by the doctor.
 */
export interface DoctorIssue {
  file: string
  level: 'high' | 'warning' | 'low'
  message: string
  suggestion?: string
  fix?: () => Promise<void>
}

/**
 * Generates a complete tree of valid documentation links and saves it to .boltdocs/link-tree.json.
 */
export async function generateLinkTree(docsDir: string, root: string = process.cwd(), config?: BoltdocsConfig, existingFiles?: string[]): Promise<LinkTree> {
  const dotBoltdocsDir = path.resolve(root, '.boltdocs')
  if (!fs.existsSync(dotBoltdocsDir)) {
    fs.mkdirSync(dotBoltdocsDir, { recursive: true })
  }

  const files = existingFiles || await fastGlob(['**/*.md', '**/*.mdx'], {
    cwd: docsDir,
    absolute: false,
    suppressErrors: true,
  })

  const base = config?.base || '/docs'
  const routes = await Promise.all(files.map(async file => {
    // If files are absolute, make them relative to docsDir
    const absFile = path.isAbsolute(file) ? file : path.resolve(docsDir, file)
    const relFile = path.relative(docsDir, absFile)
    
    // Check for permalink override
    const { data } = await getFileData(absFile)
    let route: string
    if (data.permalink) {
      route = data.permalink.startsWith('/') ? data.permalink : `/${data.permalink}`
    } else {
      route = fileToRoutePath(relFile)
    }

    if (base === '/') return route
    // Ensure base and route are joined properly with a single slash
    return (base.endsWith('/') ? base : base + '/') + (route.startsWith('/') ? route.substring(1) : route)
  }))

  if (!routes.includes(base)) routes.push(base)

  const tree: LinkTree = {
    routes: Array.from(new Set(routes)).sort(),
    timestamp: Date.now()
  }

  fs.writeFileSync(
    path.resolve(dotBoltdocsDir, 'link-tree.json'),
    JSON.stringify(tree, null, 2)
  )

  return tree
}

/**
 * Simple string similarity helper.
 */
function getSimilarity(a: string, b: string): number {
  if (a === b) return 1
  if (a.length === 0 || b.length === 0) return 0
  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost)
    }
  }
  return 1 - matrix[a.length][b.length] / Math.max(a.length, b.length)
}

const similarityCache = new Map<string, { bestMatch: string; similarity: number }>()

function getCachedSimilarity(link: string, routes: string[]): { bestMatch: string; similarity: number } {
  if (similarityCache.has(link)) return similarityCache.get(link)!
  
  let bestMatch = ''
  let maxSim = 0
  for (const route of routes) {
    if (route === link) continue
    const sim = getSimilarity(link, route)
    if (sim > maxSim) { maxSim = sim; bestMatch = route }
  }
  
  const result = { bestMatch, similarity: maxSim }
  similarityCache.set(link, result)
  return result
}

/**
 * Check for frontmatter and SEO metadata issues.
 */
export async function checkMetadata(ctx: DoctorContext): Promise<DoctorIssue[]> {
  const issues: DoctorIssue[] = []
  if (!ctx.doctorConfig.checks.metadata.enabled) return issues

  const { titleMin, titleMax, descriptionMin } = ctx.doctorConfig.checks.metadata
  const titleIndex = new Map<string, string[]>()

  for (const file of ctx.files) {
    const relPath = normalizePath(path.relative(ctx.docsDir, file))
    
    try {
      const { raw, data } = await getFileData(file)

      // 1. Malformed YAML Check
      if (raw.trim().startsWith('---')) {
        const parts = raw.split('---')
        if (parts.length >= 3 && Object.keys(data).length === 0) {
          const level = getSeverity(ctx, 'malformedFrontmatter', 'high')
          if (level !== 'off') {
            issues.push({
              file: relPath,
              level,
              message: 'Malformed frontmatter (YAML parsing failed).',
              suggestion: 'Check your YAML syntax for indentation or unquoted special characters.',
            })
          }
        }
      }

      // 2. Strict Schema Validation
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

      // 3. Custom Required Fields
      const requiredFields = Array.from(new Set(['title', ...ctx.doctorConfig.checks.metadata.required]))
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

      // 4. Date Validation
      if (ctx.doctorConfig.checks.metadata.validateDates) {
        const dateFields = ['date', 'lastUpdated', ...ctx.doctorConfig.checks.metadata.optional.filter(f => f.toLowerCase().includes('date'))]
        for (const field of dateFields) {
          if (data[field] && isNaN(Date.parse(String(data[field])))) {
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

      // 5. Title Validation
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

      // 6. Description Validation
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
    } catch (e: any) {
      const level = getSeverity(ctx, 'malformedFrontmatter', 'high')
      if (level !== 'off') {
        issues.push({
          file: relPath,
          level,
          message: `Malformed frontmatter (YAML error): ${e.message}`,
          suggestion: 'Check your YAML syntax for indentation or unquoted special characters.',
        })
      }
      continue
    }
  }

  // 7. Duplicate Title Detection (Optimized: Filter after one pass)
  for (const [title, files] of titleIndex.entries()) {
    if (files.length > 1) {
      const level = getSeverity(ctx, 'duplicateTitle', 'low')
      if (level !== 'off') {
        for (const file of files) {
          issues.push({
            file,
            level,
            message: `Duplicate title found: "${title}"`,
            suggestion: `Ensure each page has a unique title. Also used in: ${files.filter(f => f !== file).join(', ')}`,
          })
        }
      }
    }
  }

  return issues
}

/**
 * Check for broken internal and optionally external links.
 */
async function checkLinks(ctx: DoctorContext): Promise<DoctorIssue[]> {
  const issues: DoctorIssue[] = []
  const { internal, external, ignore, timeout: linkTimeout, concurrency } = ctx.doctorConfig.checks.links

  if (!internal && !external && !ctx.options.checkExternal) return issues

  // COMBINAR REGEX EN UNA SOLA PASADA (más eficiente que dos matchAll)
  const combinedRegex = /(?:\[.*?\]\((.*?)\))|(?:<a\s+[^>]*href=["']([^"']+)["'][^>]*>)/g

  const externalLinks = new Set<{ url: string; file: string }>()
  const MAX_SCAN_SIZE = 500_000 // 500KB

  for (const file of ctx.files) {
    const relPath = normalizePath(path.relative(ctx.docsDir, file))
    const { raw, content } = await getFileData(file)
    
    const scanContent = content.length > MAX_SCAN_SIZE 
      ? content.slice(0, MAX_SCAN_SIZE) 
      : content

    const links = [...scanContent.matchAll(combinedRegex)].map(m => m[1] || m[2])

    for (const originalLink of links) {
      if (!originalLink) continue

      // Skip ignored links from config
      if (ignore.some(i => originalLink.includes(i))) continue

      // External Links
      if (/^https?:\/\//i.test(originalLink)) {
        if (external || ctx.options.checkExternal) {
          externalLinks.add({ url: originalLink, file })
        }
        continue
      }

      if (!internal) continue

      // Skip non-HTTP internal links
      if (/^(mailto|tel|#)/i.test(originalLink)) continue

      // Decode URL encoding (like %20 for spaces)
      let link: string
      try {
        link = decodeURIComponent(originalLink.split('#')[0].split('?')[0])
      } catch {
        link = originalLink.split('#')[0].split('?')[0]
      }

      if (!link) continue

      // Validate internal link
      let targetExists = false
      let resolvedInternalPath = ''

      if (link.startsWith('/')) {
        // 1. Check if it's a valid route in the link tree (O(1) lookups)
        if (ctx.routeIndex.has(link) || ctx.routeIndexWithSlash.has(link) || ctx.routeIndexWithoutSlash.has(link)) {
          targetExists = true
        } else {
          // 2. Precise detection: did the user forget the base path?
          const linkWithBase = ctx.basePrefix + (link.startsWith('/') ? link : '/' + link)

          if (ctx.routeIndex.has(linkWithBase) || ctx.routeIndexWithSlash.has(linkWithBase)) {
            // It's a broken link specifically because of missing base
            targetExists = false
            // We set targetPath for the suggestion
            resolvedInternalPath = linkWithBase
          } else {
            // 3. Fallback: Check if it's a static file on disk (e.g. assets)
            const pathAfterBase = (ctx.config.base !== '/' && link.startsWith(ctx.config.base || '/'))
              ? link.substring((ctx.config.base || '/').length)
              : link

            const cleanPathAfterBase = pathAfterBase.startsWith('/') ? pathAfterBase.substring(1) : pathAfterBase
            resolvedInternalPath = path.join(ctx.docsDir, cleanPathAfterBase)

            // Check for file directly or with markdown extensions
            const extensions = ['', '.md', '.mdx', '/index.md', '/index.mdx']
            targetExists = extensions.some(ext => cachedExists(resolvedInternalPath + ext))
          }
        }
      } else {
        // Relative link: check against filesystem
        resolvedInternalPath = path.resolve(path.dirname(file), link)
        const extensions = ['', '.md', '.mdx', '/index.md', '/index.mdx']
        targetExists = extensions.some(ext => cachedExists(resolvedInternalPath + ext))
      }

      if (!targetExists) {
        let { bestMatch, similarity: maxSimilarity } = getCachedSimilarity(link, ctx.linkTree.routes)

        // If we already found a base-path-prefixed match in detectedBaseMissing, 
        // use it as the best match and force confidence.
        let detectedBaseMissing = false
        const linkWithBase = ctx.basePrefix + (link.startsWith('/') ? link : '/' + link)
        if (ctx.routeIndex.has(linkWithBase) || ctx.routeIndexWithSlash.has(linkWithBase)) {
          bestMatch = linkWithBase
          maxSimilarity = 1.0
          detectedBaseMissing = true
        }

        const isConfident = (maxSimilarity > 0.6 && bestMatch !== link) || detectedBaseMissing
        const level = getSeverity(ctx, 'brokenLink', 'high')
        if (level !== 'off') {
          issues.push({
            file: relPath,
            level,
            message: `Broken internal link: "${originalLink}"`,
            suggestion: isConfident ? `Did you mean "${bestMatch}"?` : `File not found at "${resolvedInternalPath}".`,
            fix: isConfident ? async () => {
              const anchor = originalLink.includes('#') ? '#' + originalLink.split('#')[1] : ''
              const fixedContent = raw.replace(`(${originalLink})`, `(${bestMatch}${anchor})`)
              fs.writeFileSync(file, fixedContent)
              // Update cache
              fileCache.delete(file)
            } : undefined
          })
        }
      }
    }
  }

  // Handle External Links
  if (externalLinks.size > 0) {
    ui.info(`${ui.colors.gray}Verifying ${externalLinks.size} external links...${ui.colors.reset}`)

    // Group by URL to avoid redundant checks
    const urlToFile = new Map<string, string[]>()
    for (const item of externalLinks) {
      if (!urlToFile.has(item.url)) urlToFile.set(item.url, [])
      urlToFile.get(item.url)!.push(item.file)
    }

    const checkUrl = async (url: string): Promise<{ url: string; ok: boolean; error?: string }> => {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), linkTimeout)
        const res = await fetch(url, {
          method: 'HEAD',
          signal: controller.signal,
          headers: { 'User-Agent': 'boltdocs-doctor/1.0' }
        })
        clearTimeout(timeout)

        // Some sites block HEAD, try GET
        if (!res.ok && res.status !== 404) {
          const resGet = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            headers: { 'User-Agent': 'boltdocs-doctor/1.0' }
          })
          return { url, ok: resGet.ok }
        }

        return { url, ok: res.ok }
      } catch (e: any) {
        return { url, ok: false, error: e.message }
      }
    }

    // USAR Promise.allSettled EN LUGAR DE batches manuales
    const urls = Array.from(urlToFile.keys())
    const results: any[] = []
    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency)
      const batchResults = await Promise.allSettled(batch.map(checkUrl))
      results.push(...batchResults.map(r => r.status === 'fulfilled' ? r.value : { url: 'unknown', ok: false, error: (r as PromiseRejectedResult).reason }))
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

/**
 * Check for i18n issues (missing and orphaned translations).
 */
async function checkI18n(ctx: DoctorContext): Promise<DoctorIssue[]> {
  const issues: DoctorIssue[] = []
  if (!ctx.doctorConfig.checks.i18n.enabled || !ctx.config.i18n) return issues

  const { defaultLocale, locales } = ctx.config.i18n
  const allLocales = Object.keys(locales)
  const otherLocales = allLocales.filter(l => l !== defaultLocale)

  for (const file of ctx.files) {
    const relPath = normalizePath(path.relative(ctx.docsDir, file))
    const parts = relPath.split('/')
    const locale = parts[0]

    // 1. Missing Translations (Source in defaultLocale -> Missing in others)
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
                if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })
                fs.copyFileSync(file, targetPath)
              }
            })
          }
        }
      }
    }
    // 2. Orphaned Translations (Translation exists -> Source missing)
    else if (allLocales.includes(locale)) {
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
            }
          })
        }
      }
    }
  }
  return issues
}

/**
 * Check the sidebar configuration for broken links and orphaned pages.
 */
async function checkSidebar(ctx: DoctorContext): Promise<DoctorIssue[]> {
  const issues: DoctorIssue[] = []
  if (!ctx.config.theme.sidebar) return issues

  const linkedRoutes = new Set<string>()
  const sidebar = ctx.config.theme.sidebar

  for (const [group, items] of Object.entries(sidebar)) {
    for (const item of items) {
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

        // Check if sidebar link is broken
        if (!ctx.routeIndex.has(item.link)) {
          let { bestMatch, similarity: maxSimilarity } = getCachedSimilarity(item.link, ctx.linkTree.routes)

          const isConfident = maxSimilarity > 0.6
          const level = getSeverity(ctx, 'brokenLink', 'high')
          if (level !== 'off') {
            issues.push({
              file: 'boltdocs.config.ts',
              level,
              message: `Broken sidebar link: "${item.link}"`,
              suggestion: isConfident ? `Did you mean "${bestMatch}"?` : 'Ensure the route exists and is correctly formatted.',
            })
          }
        }
      }
    }
  }

  // Orphaned Pages Detection (Files that exist but aren't in the sidebar)
  // We exclude the home page '/' usually
  for (const route of ctx.linkTree.routes) {
    if (route === '/' || route === '') continue
    if (!linkedRoutes.has(route)) {
      const level = getSeverity(ctx, 'orphanedPage', 'low')
      if (level !== 'off') {
        issues.push({
          file: 'Sidebar',
          level,
          message: `Orphaned page found: "${route}" is not linked in the sidebar.`,
          suggestion: 'Consider adding it to the sidebar for better discoverability.',
        })
      }
    }
  }

  return issues
}

/**
 * Initialize doctor.json with default configuration.
 */
export async function doctorInit(root: string) {
  const configPath = path.resolve(root, 'doctor.json')
  if (fs.existsSync(configPath)) {
    ui.warn(`"doctor.json" already exists at ${root}.`)
    return
  }

  try {
    fs.writeFileSync(configPath, JSON.stringify(DEFAULT_DOCTOR_CONFIG, null, 2))
    ui.success(`Created "doctor.json" with default configuration.`)
  } catch (e) {
    ui.error(`Failed to create "doctor.json": ${e}`)
  }
}

/**
 * Main doctor entry point.
 */
export async function doctorAction(root: string = process.cwd(), options: { fix?: boolean; checkExternal?: boolean; init?: boolean } = {}) {
  if (options.init) {
    await doctorInit(root)
    return
  }

  try {
    const doctorConfig = await loadDoctorConfig(root)
    const { format } = doctorConfig.reporting
    const { colors } = ui

    if (format === 'pretty') {
      ui.box('DOCTOR - Documentation Health Check')
    }

    const start = performance.now()
    const config = await resolveConfig('docs', root)
    const docsDir = path.resolve(root, 'docs')
    if (!fs.existsSync(docsDir)) {
      if (format === 'pretty') ui.error(`Docs dir not found at ${docsDir}`)
      process.exit(1)
    }

    if (format === 'pretty') {
      ui.info(`${ui.colors.dim}🔍 Discovering files and routes...${ui.colors.reset}`)
    }
    const files = await fastGlob(['**/*.md', '**/*.mdx'], {
      cwd: docsDir,
      absolute: true,
      suppressErrors: true,
      ignore: doctorConfig.exclude
    })
    const linkTree = await generateLinkTree(docsDir, root, config, files)

    const base = config.base || '/'
    const basePrefix = base === '/' ? '' : (base.endsWith('/') ? base.slice(0, -1) : base)
    const routeIndex = new Set(linkTree.routes)
    const routeIndexWithSlash = new Set(linkTree.routes.map(r => r.endsWith('/') ? r : r + '/'))
    const routeIndexWithoutSlash = new Set(linkTree.routes.map(r => r.endsWith('/') ? r.slice(0, -1) : r))

    const ctx: DoctorContext = { 
      root, docsDir, config, doctorConfig, linkTree, files, options,
      routeIndex, routeIndexWithSlash, routeIndexWithoutSlash, basePrefix
    }

    if (format === 'pretty') {
      ui.info(`${ui.colors.dim}📦 Pre-loading documentation files...${ui.colors.reset}`)
    }
    // Batch pre-loading to avoid hitting open file limits
    const BATCH_SIZE = 100
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      await Promise.all(files.slice(i, i + BATCH_SIZE).map(f => getFileData(f)))
    }

    if (format === 'pretty') {
      ui.info(`${ui.colors.dim}🧪 Running diagnostic checks in parallel...${ui.colors.reset}`)
    }

    const [metadataIssues, linkIssues, i18nIssues, sidebarIssues] = await Promise.all([
      checkMetadata(ctx),
      checkLinks(ctx),
      checkI18n(ctx),
      checkSidebar(ctx)
    ])

    const issues = [...metadataIssues, ...linkIssues, ...i18nIssues, ...sidebarIssues]

    // 1. Handle Automatic Fixes
    let fixedCount = 0
    if (options.fix) {
      for (const issue of issues) {
        if (issue.fix) {
          if (ctx.doctorConfig.fix.confirmChanges) {
            const confirmed = await ui.confirm(`Fix issue in "${issue.file}": ${issue.message}?`)
            if (!confirmed) continue
          }
          if (ctx.doctorConfig.fix.backupFiles) {
            const absolutePath = path.resolve(ctx.docsDir, issue.file)
            if (fs.existsSync(absolutePath)) {
              const backupDir = path.resolve(ctx.root, ctx.doctorConfig.fix.backupPath)
              await backupFile(absolutePath, backupDir)
            }
          }
          await issue.fix()
          fixedCount++
        }
      }
    }

    const duration = ((performance.now() - start) / 1000).toFixed(2)
    const high = issues.filter(i => i.level === 'high').length
    const warning = issues.filter(i => i.level === 'warning').length
    const low = issues.filter(i => i.level === 'low').length

    // 2. Reporting
    const reportFormat = doctorConfig.reporting.format
    const reportData = {
      timestamp: new Date().toISOString(),
      duration: parseFloat(duration),
      summary: { high, warning, low, fixed: fixedCount, total: issues.length },
      issues: issues.map(i => ({
        file: i.file,
        level: i.level,
        message: i.message,
        suggestion: i.suggestion
      }))
    }

    // Save to file if configured
    if (doctorConfig.reporting.outputFile) {
      const outputPath = path.resolve(root, doctorConfig.reporting.outputFile)
      const outputDir = path.dirname(outputPath)
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })
      fs.writeFileSync(outputPath, JSON.stringify(reportData, null, 2))
    }

    if (reportFormat === 'json') {
      console.log(JSON.stringify(reportData, null, 2))
    } else if (reportFormat === 'pretty') {
      const groupedIssues = issues.reduce((acc, issue) => {
        if (!acc[issue.file]) acc[issue.file] = []
        acc[issue.file].push(issue)
        return acc
      }, {} as Record<string, DoctorIssue[]>)

      if (issues.length > 0) {
        ui.divider()
        for (const [file, fileIssues] of Object.entries(groupedIssues)) {
          console.log(`\n${colors.bold}${colors.cyan}📄 ${file}${colors.reset}`)
          for (const issue of fileIssues) {
            const icon = issue.level === 'high' ? '❌' : issue.level === 'warning' ? '⚠️' : 'ℹ️'
            const color = issue.level === 'high' ? colors.red : issue.level === 'warning' ? colors.yellow : colors.blue
            console.log(`   ${icon} ${color}${issue.level.toUpperCase()}${colors.reset}: ${issue.message}`)
            if (issue.suggestion) {
              console.log(`      ${colors.dim}💡 Suggestion: ${issue.suggestion}${colors.reset}`)
            }
            if (options.fix && issue.fix) {
              console.log(`      ${colors.green}✅ Fixed automatically${colors.reset}`)
            }
          }
        }
        ui.divider()
      }

      if (issues.length === 0) {
        ui.success('Everything looks perfect! Your documentation is in great shape. ✨')
      } else {
        console.log(`\n${colors.bold}Diagnosis Results (${duration}s):${colors.reset}`)
        if (high > 0) console.log(`   ${colors.red}● ${high} Critical Errors${colors.reset}`)
        if (warning > 0) console.log(`   ${colors.yellow}● ${warning} Warnings${colors.reset}`)
        if (low > 0) console.log(`   ${colors.blue}● ${low} Improvements${colors.reset}`)

        if (fixedCount > 0) {
          ui.success(`Successfully fixed ${fixedCount} issues automatically!`)
        }

        if (high > 0) {
          console.log(`\n${colors.red}${colors.bold}[boltdocs] Please fix the critical errors before building for production.${colors.reset}`)
        } else {
          ui.success('[boltdocs] No critical issues found. You are ready to go!')
        }
      }
    }

    // 3. Exit Conditions
    if (doctorConfig.reporting.failOnError && high > 0) {
      process.exit(1)
    }
    if (doctorConfig.reporting.maxWarnings !== -1 && warning > doctorConfig.reporting.maxWarnings) {
      if (reportFormat === 'pretty') ui.error(`Failed: Too many warnings (${warning} > ${doctorConfig.reporting.maxWarnings})`)
      process.exit(1)
    }

  } catch (e) {
    ui.error(`Doctor failed: ${e}`)
    process.exit(1)
  }
}