import type { RouteMeta } from 'boltdocs'

export interface FeedConfig {
  title: string
  description: string
  siteUrl: string
  language: string
  locale: string
}

export interface FeedItem {
  title: string
  path: string
  description?: string
  pubDate: string
  guid: string
  author?: string
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatDateForRss(date: Date): string {
  return date.toUTCString()
}

function formatDateForAtom(date: Date): string {
  return date.toISOString()
}

function routesToFeedItems(routes: RouteMeta[], siteUrl: string): FeedItem[] {
  return routes
    .filter((route) => !route.draft)
    .map((route) => {
      const date = route.date
        ? new Date(route.date)
        : route.lastUpdated
          ? new Date(route.lastUpdated)
          : new Date()

      return {
        title: route.title,
        path: route.path,
        description: route.excerpt ?? route.description,
        pubDate: formatDateForRss(date),
        guid: `${siteUrl}${route.path}`,
        author: route.author,
      }
    })
}

export function generateRssXml(
  config: FeedConfig,
  routes: RouteMeta[],
): string {
  const siteUrl = config.siteUrl.replace(/\/$/, '')
  const items = routesToFeedItems(routes, siteUrl)

  const itemsXml = items
    .map(
      (item) => `    <item>
      <title><![CDATA[${escapeXml(item.title)}]]></title>
      <link>${escapeXml(siteUrl + item.path)}</link>
      ${item.description ? `<description><![CDATA[${escapeXml(item.description)}]]></description>` : ''}
      <pubDate>${item.pubDate}</pubDate>
      <guid isPermaLink="true">${escapeXml(item.guid)}</guid>
    </item>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(config.title)}</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>${escapeXml(config.description)}</description>
    <language>${escapeXml(config.language)}</language>
    <atom:link href="${escapeXml(siteUrl + `/rss/feed-${config.locale}.xml`)}" rel="self" type="application/rss+xml"/>
${itemsXml}
  </channel>
</rss>`
}

export function generateAtomXml(
  config: FeedConfig,
  routes: RouteMeta[],
): string {
  const siteUrl = config.siteUrl.replace(/\/$/, '')
  const items = routesToFeedItems(routes, siteUrl)

  const entriesXml = items
    .map(
      (item) => `  <entry>
    <title>${escapeXml(item.title)}</title>
    <link href="${escapeXml(siteUrl + item.path)}" rel="alternate"/>
    <id>${escapeXml(item.guid)}</id>
    <updated>${formatDateForAtom(new Date(item.pubDate))}</updated>
    ${item.description ? `<summary>${escapeXml(item.description)}</summary>` : ''}
  </entry>`,
    )
    .join('\n')

  const latestDate =
    items.length > 0 ? items[0].pubDate : new Date().toUTCString()

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${escapeXml(config.language)}">
  <title>${escapeXml(config.title)}</title>
  <link href="${escapeXml(siteUrl)}" rel="alternate"/>
  <link href="${escapeXml(siteUrl + `/rss/atom-${config.locale}.xml`)}" rel="self"/>
  <id>${escapeXml(siteUrl)}</id>
  <updated>${formatDateForAtom(new Date(latestDate))}</updated>
${entriesXml}
</feed>`
}
