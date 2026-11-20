import { toSingleLine } from '../../utils/plain-text'

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
  data: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const seo: Record<string, unknown> = {}

  if (data.seo && typeof data.seo === 'object') {
    Object.assign(seo, data.seo)
  }

  for (const key of Object.keys(data)) {
    if (
      EXPLICIT_SEO_KEYS.includes(key) ||
      SEO_PREFIXES.some((p) => key.startsWith(p))
    ) {
      seo[key] = data[key]
    }
  }

  if (data.hidden === true && seo.noindex === undefined) {
    seo.noindex = true
  }

  return Object.keys(seo).length > 0 ? seo : undefined
}

export function sanitizeFrontmatterStrings(data: Record<string, unknown>): {
  title?: string
  badge?: string
  description?: string
} {
  return {
    title: data.title ? toSingleLine(String(data.title)) : undefined,
    badge: data.badge ? toSingleLine(String(data.badge)) : undefined,
    description: data.description
      ? toSingleLine(String(data.description))
      : undefined,
  }
}
