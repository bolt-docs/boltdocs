import fs from 'fs'
import matter from 'gray-matter'
import DOMPurify from 'isomorphic-dompurify'
import {
  MAX_PATH_LENGTH,
  ALLOWED_PATH_CHARS,
  MAX_FRONTMATTER_SIZE,
} from './security/constants'
import { FrontmatterSchema, type FrontmatterData } from './schema/frontmatter'

export {
  MAX_PATH_LENGTH,
  ALLOWED_PATH_CHARS,
  MAX_FRONTMATTER_SIZE,
  FrontmatterSchema,
  type FrontmatterData,
}
import { ValidationError } from './errors'

// Removed centralized constants - now in security.config.ts

/**
 * Normalizes a file path by replacing Windows backslashes with forward slashes.
 * Ensures consistent path handling across different operating systems.
 *
 * @param p - The file path to normalize
 * @returns The normalized path using forward slashes
 */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/')
}

/**
 * Strips a numeric prefix from a file or directory name (e.g., '1.guide' -> 'guide').
 *
 * @param name - The name to strip
 * @returns The name without the numeric prefix
 */
export function stripNumberPrefix(name: string): string {
  return name.replace(/^\d+\./, '')
}

/**
 * Extracts the numeric prefix from a file or directory name if it exists.
 *
 * @param name - The name to parse
 * @returns The extracted number, or undefined if none exists
 */
export function extractNumberPrefix(name: string): number | undefined {
  const match = name.match(/^(\d+)\./)
  return match ? parseInt(match[1], 10) : undefined
}

/**
 * Checks if a given file path points to a Markdown or MDX file.
 *
 * @param filePath - The path to check
 * @returns True if the file ends with .md or .mdx, false otherwise
 */
export function isDocFile(filePath: string): boolean {
  return /\.mdx?$/.test(filePath)
}

/**
 * Retrieves the modification time (mtime) of a file in milliseconds.
 * Useful for caching strategies to detect if a file has changed.
 * Returns 0 if the file doesn't exist or cannot be accessed.
 *
 * @param filePath - The absolute path to the file
 * @returns The modification time in milliseconds, or 0 on error
 */
export function getFileMtime(filePath: string): number {
  try {
    return fs.statSync(filePath).mtimeMs
  } catch {
    return 0
  }
}

/**
 * Parses frontmatter and markdown content from a file synchronously.
 * Uses `gray-matter` for parsing. Returns the parsed data and the remaining markdown content.
 *
 * @param filePath - The absolute path to the markdown/mdx file
 * @returns An object containing the parsed metadata (`data`) and the raw markdown (`content`)
 */
export function parseFrontmatter(filePath: string, validate = true): {
  data: any
  content: string
  raw: string
} {
  const raw = fs.readFileSync(filePath, 'utf-8')
  try {
    const { data, content, matter: rawMatter } = matter(raw)

    // Security: Check frontmatter size
    if (rawMatter && rawMatter.length > MAX_FRONTMATTER_SIZE) {
      logSecurityEvent(
        'FRONTMATTER_TOO_LARGE',
        'Frontmatter block exceeds size limit',
        {
          size: rawMatter.length,
          file: filePath,
        },
      )
      throw new ValidationError(
        `Security breach: Frontmatter size exceeds limit of ${MAX_FRONTMATTER_SIZE} bytes`,
      )
    }

    if (!validate) {
      return { data, content, raw }
    }

    // Validation: Schema check
    const result = FrontmatterSchema.safeParse(data)
    
    // Explicitly allow only known fields from the schema for security (unless we use passthrough)
    const validatedData = result.success ? result.data : {}

    // Sanitization: Clean metadata fields
    const sanitizedData: any = { ...validatedData }

    // Auto-populate lastUpdated if missing
    if (!sanitizedData.lastUpdated) {
      sanitizedData.lastUpdated = getFileMtime(filePath)
    }
    if (sanitizedData.title)
      sanitizedData.title = stripHtmlTags(sanitizedData.title).trim()
    if (sanitizedData.description)
      sanitizedData.description = stripHtmlTags(
        sanitizedData.description,
      ).trim()

    return { data: sanitizedData, content, raw }
  } catch (e) {
    if (e instanceof ValidationError) throw e
    // If frontmatter is malformed (e.g. while editing), return empty data and raw content
    return { data: {}, content: raw, raw }
  }
}

/**
 * Parses frontmatter and markdown content from a file asynchronously.
 * Uses `gray-matter` for parsing. Returns the parsed data and the remaining markdown content.
 *
 * @param filePath - The absolute path to the markdown/mdx file
 * @returns An object containing the parsed metadata (`data`) and the raw markdown (`content`)
 */
export async function parseFrontmatterAsync(filePath: string, validate = true): Promise<{
  data: any
  content: string
  raw: string
}> {
  try {
    const raw = await fs.promises.readFile(filePath, 'utf-8')
    const { data, content, matter: rawMatter } = matter(raw)

    // Security: Check frontmatter size
    if (rawMatter && rawMatter.length > MAX_FRONTMATTER_SIZE) {
      logSecurityEvent(
        'FRONTMATTER_TOO_LARGE',
        'Frontmatter block exceeds size limit',
        {
          size: rawMatter.length,
          file: filePath,
        },
      )
      throw new ValidationError(
        `Security breach: Frontmatter size exceeds limit of ${MAX_FRONTMATTER_SIZE} bytes`,
      )
    }

    if (!validate) {
      return { data, content, raw }
    }

    // Validation: Schema check
    const result = FrontmatterSchema.safeParse(data)
    
    // Explicitly allow only known fields from the schema for security (unless we use passthrough)
    const validatedData = result.success ? result.data : {}

    // Sanitization: Clean metadata fields
    const sanitizedData: any = { ...validatedData }

    // Auto-populate lastUpdated if missing
    if (!sanitizedData.lastUpdated) {
      const stats = await fs.promises.stat(filePath);
      sanitizedData.lastUpdated = stats.mtimeMs;
    }
    if (sanitizedData.title)
      sanitizedData.title = stripHtmlTags(sanitizedData.title).trim()
    if (sanitizedData.description)
      sanitizedData.description = stripHtmlTags(
        sanitizedData.description,
      ).trim()

    return { data: sanitizedData, content, raw }
  } catch (e) {
    if (e instanceof ValidationError) throw e
    // If file cannot be read, it might be a race condition during deletion
    try {
      const rawFallback = await fs.promises.readFile(filePath, 'utf-8')
      return { data: {}, content: rawFallback, raw: rawFallback }
    } catch {
       return { data: {}, content: '', raw: '' }
    }
  }
}

/**
 * Escapes special HTML characters in a string to prevent XSS and ensure
 * safe injection into HTML attributes or text content.
 *
 * @param str - The raw string to escape
 * @returns The escaped string
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Alias for escapeHtml to be used in XML contexts (like sitemaps).
 *
 * @param str - The raw string to escape
 * @returns The escaped string
 */
export function escapeXml(str: string): string {
  return escapeHtml(str)
}

/**
 * Converts a file path relative to the `docsDir` into a URL route path.
 * Handles removing extensions, converting `index` files to directory roots,
 * and ensuring proper slash formatting.
 *
 * @param relativePath - The file path relative to the documentation source directory (e.g., 'guide/index.md')
 * @returns The corresponding route path (e.g., '/guide')
 */
export function fileToRoutePath(relativePath: string): string {
  // Strip number prefixes and sanitize each segment
  const cleanedPath = normalizePath(relativePath)
    .split('/')
    .map((p) => sanitizeFilename(stripNumberPrefix(p)))
    .join('/')

  // Remove trailing slash if present
  let routePath = cleanedPath.replace(/\/$/, '')

  routePath = routePath.replace(/\.mdx?$/, '')

  // Handle index files → directory root
  if (routePath === 'index' || routePath.endsWith('/index')) {
    routePath = routePath.replace(/index$/, '')
  }

  // Ensure leading slash
  if (!routePath.startsWith('/')) {
    routePath = '/' + routePath
  }

  // Remove trailing slash (except for root '/')
  if (routePath.length > 1 && routePath.endsWith('/')) {
    routePath = routePath.slice(0, -1)
  }

  return routePath
}

/**
 * Sanitizes an HTML string using DOMPurify to prevent XSS.
 * By default, it allows a safe subset of HTML tags.
 *
 * @param html - The raw HTML string
 * @returns The sanitized HTML
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'b',
      'i',
      'em',
      'strong',
      'a',
      'p',
      'br',
      'code',
      'pre',
      'span',
      'div',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'ul',
      'ol',
      'li',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'blockquote',
      'hr',
    ],
    ALLOWED_ATTR: [
      'href',
      'title',
      'target',
      'class',
      'id',
      'src',
      'alt',
      'width',
      'height',
    ],
    FORCE_BODY: true,
  })
}

// Security Hook: Validate URL protocols in href/src
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  // Check for href
  if (node.hasAttribute('href')) {
    const href = node.getAttribute('href')?.toLowerCase() || ''
    if (
      href.startsWith('javascript:') ||
      href.startsWith('data:') ||
      href.startsWith('vbscript:')
    ) {
      node.removeAttribute('href')
    }
  }
  // Check for src
  if (node.hasAttribute('src')) {
    const src = node.getAttribute('src')?.toLowerCase() || ''
    if (
      src.startsWith('javascript:') ||
      src.startsWith('data:') ||
      src.startsWith('vbscript:')
    ) {
      node.removeAttribute('src')
    }
  }
})

/**
 * Strips all HTML tags from a string, returning only the text content.
 * Uses DOMPurify for secure and complete tag removal.
 *
 * @param html - The string containing HTML tags
 * @returns The plain text content
 */
export function stripHtmlTags(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: [], KEEP_CONTENT: true })
}

/**
 * Capitalizes the first letter of a given string.
 * Used primarily for generating default group titles.
 *
 * @param str - The string to capitalize
 * @returns The capitalized string
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Retrieves the correct translation from a value that can be either
 * a simple string or a map of locale-specific strings.
 * Node-side version for SSG and config resolution.
 *
 * @param value - The text to translate
 * @param locale - The current active locale (e.g., 'en', 'es')
 * @returns The translated string
 */
export function getTranslated(
  value: string | Record<string, string> | undefined,
  locale?: string,
): string {
  if (!value) return ''
  if (typeof value === 'string') return value

  if (locale && value[locale]) {
    return value[locale]
  }

  // Fallback: Use the first available translation or an empty string
  const firstValue = Object.values(value)[0]
  return firstValue || ''
}
/**
 * Sanitizes a filename or path component by removing dangerous characters.
 * Prevents multiple dots to avoid path traversal tricks.
 *
 * @param name - The name to sanitize
 * @returns The sanitized name
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\-_\/\.]/g, '') // Remove non-whitelisted characters
    .split('/')
    .filter((p) => p !== '..' && p !== '.') // Remove traversal and current dir indicators
    .map((p) => p.replace(/\.\.+/g, '.')) // Prevent multiple dots in segments
    .join('/')
}

/**
 * Logs a security violation with relevant metadata.
 * Redacts absolute paths to prevent information leakage.
 */
export function logSecurityEvent(
  type: string,
  message: string,
  details: Record<string, any> = {},
): void {
  const timestamp = new Date().toISOString()
  const redactedDetails = { ...details }

  // Simple redaction logic for potential system paths
  for (const key in redactedDetails) {
    if (
      typeof redactedDetails[key] === 'string' &&
      redactedDetails[key].includes(':')
    ) {
      // Very basic redaction: just keep the filename part if it looks like a path
      redactedDetails[key] =
        redactedDetails[key].split(/[\\/]/).pop() || redactedDetails[key]
    }
  }

  console.error(
    `[SECURITY][${timestamp}] TYPE: ${type} | MESSAGE: ${message} | DETAILS: ${JSON.stringify(
      redactedDetails,
    )}`,
  )
}

/**
 * Retrieves the global cache configuration from environment variables.
 * Centralizes documented variables like BOLTDOCS_CACHE_DIR and BOLTDOCS_NO_CACHE.
 */
export function getCacheConfig() {
  return {
    dir: process.env.BOLTDOCS_CACHE_DIR || '.boltdocs',
    noCache: process.env.BOLTDOCS_NO_CACHE === '1',
    lruLimit: parseInt(process.env.BOLTDOCS_CACHE_LRU_LIMIT || '2000', 10),
    lruTTL: parseInt(process.env.BOLTDOCS_CACHE_LRU_TTL || '14400000', 10), // Default 4 hours
    compress: process.env.BOLTDOCS_CACHE_COMPRESS !== '0',
  }
}

