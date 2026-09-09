import type { JsonLdObject, StructuredData } from './types'

export interface WebSiteStructuredDataOptions {
  name: string
  url: string
  description?: string
  searchUrl?: string
}

export interface ArticleStructuredDataOptions {
  headline: string
  url: string
  description?: string
  datePublished?: string | Date
  dateModified?: string | Date
  image?: string
  author?: string | { name: string; url?: string }
}

export interface BreadcrumbStructuredDataItem {
  name: string
  url: string
}

export interface StructuredDataFactoryOptions {
  /** A WebSite graph for the global site identity. */
  website?: WebSiteStructuredDataOptions
  /** An Article graph for the current page or release post. */
  article?: ArticleStructuredDataOptions
  /** A BreadcrumbList graph for the current page hierarchy. */
  breadcrumbs?: BreadcrumbStructuredDataItem[]
  /** Additional graph nodes for schema types not covered by the presets. */
  additional?: JsonLdObject | JsonLdObject[]
}

/** Preserve literal JSON-LD types in config files and frontmatter helpers. */
export function defineStructuredData<T extends StructuredData>(data: T): T {
  return data
}

/**
 * Creates one JSON-LD value from the common website/article/breadcrumb presets.
 * Single-node input returns an object; multiple nodes return a graph array.
 */
export function createStructuredData(
  options: StructuredDataFactoryOptions,
): StructuredData {
  const nodes: JsonLdObject[] = []

  if (options.website) {
    nodes.push(createWebSiteStructuredData(options.website))
  }
  if (options.article) {
    nodes.push(createArticleStructuredData(options.article))
  }
  if (options.breadcrumbs?.length) {
    nodes.push(createBreadcrumbStructuredData(options.breadcrumbs))
  }
  if (options.additional) {
    nodes.push(
      ...(Array.isArray(options.additional)
        ? options.additional
        : [options.additional]),
    )
  }

  if (nodes.length === 0) {
    throw new Error(
      'createStructuredData() requires at least one of website, article, breadcrumbs, or additional',
    )
  }

  return nodes.length === 1 ? nodes[0] : nodes
}

export function createWebSiteStructuredData(
  options: WebSiteStructuredDataOptions,
): JsonLdObject {
  const data: JsonLdObject = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: options.name,
    url: options.url,
  }

  if (options.description) data.description = options.description
  if (options.searchUrl) {
    data.potentialAction = {
      '@type': 'SearchAction',
      target: `${options.searchUrl}{search_term_string}`,
      'query-input': 'required name=search_term_string',
    }
  }

  return data
}

function toIsoDate(value: string | Date, field: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`Invalid ${field} value: ${String(value)}`)
  }
  return date.toISOString()
}

export function createArticleStructuredData(
  options: ArticleStructuredDataOptions,
): JsonLdObject {
  const data: JsonLdObject = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: options.headline,
    url: options.url,
  }

  if (options.description) data.description = options.description
  if (options.datePublished)
    data.datePublished = toIsoDate(options.datePublished, 'datePublished')
  if (options.dateModified)
    data.dateModified = toIsoDate(options.dateModified, 'dateModified')
  if (options.image) data.image = options.image
  if (options.author) {
    data.author =
      typeof options.author === 'string'
        ? { '@type': 'Person', name: options.author }
        : { '@type': 'Person', ...options.author }
  }

  return data
}

export function createBreadcrumbStructuredData(
  items: BreadcrumbStructuredDataItem[],
): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}
