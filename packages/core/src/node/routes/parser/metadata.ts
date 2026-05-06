import { sanitizeHtml } from '../../utils'

const SEO_PREFIXES = [
  'og:',
  'twitter:',
  'article:',
  'music:',
  'video:',
  'profile:',
  'book:',
]
const EXPLICIT_SEO_KEYS = [
  'noindex',
  'robots',
  'canonical',
  'keywords',
  'author',
]

export function processSeoData(
  data: Record<string, any>,
): Record<string, any> | undefined {
  const seo: Record<string, any> = {}

  // 1. Nested SEO object
  if (data.seo && typeof data.seo === 'object') {
    Object.assign(seo, data.seo)
  }

  // 2. Flat SEO keys
  for (const key of Object.keys(data)) {
    if (
      EXPLICIT_SEO_KEYS.includes(key) ||
      SEO_PREFIXES.some((p) => key.startsWith(p))
    ) {
      seo[key] = data[key]
    }
  }

  // 3. Hidden page sync
  if (data.hidden === true && seo.noindex === undefined) {
    seo.noindex = true
  }

  return Object.keys(seo).length > 0 ? seo : undefined
}

export function sanitizeFrontmatterStrings(
  data: Record<string, any>,
): Record<string, any> {
  return {
    title: data.title ? sanitizeHtml(String(data.title)) : undefined,
    badge: data.badge ? sanitizeHtml(String(data.badge)) : undefined,
    description: data.description
      ? sanitizeHtml(String(data.description))
      : undefined,
  }
}
