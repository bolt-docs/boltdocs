import { describe, it, expect } from 'vitest'
import {
  generateRssXml,
  generateAtomXml,
  type FeedConfig,
} from '../src/node/feed-generator'
import type { RouteMeta } from 'boltdocs'

const config: FeedConfig = {
  title: 'My Docs',
  description: 'Docs & guides',
  siteUrl: 'https://example.com/',
  language: 'en',
  locale: 'en',
}

const datedRoutes = [
  {
    path: '/docs/start',
    title: 'Get Started',
    excerpt: 'A <guide> & more',
    date: '2026-01-15T10:00:00.000Z',
  },
  {
    path: '/docs/legacy',
    title: 'Old Page',
    description: 'Legacy content',
    lastUpdated: '2025-12-01T00:00:00.000Z',
  },
  {
    path: '/docs/draft',
    title: 'Hidden Draft',
    date: '2026-02-01T00:00:00.000Z',
    draft: true,
  },
] as RouteMeta[]

describe('generateRssXml', () => {
  it('renders the full feed with strict exact output', () => {
    const xml = generateRssXml(config, datedRoutes)

    expect(xml).toBe(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>My Docs</title>
    <link>https://example.com</link>
    <description>Docs &amp; guides</description>
    <language>en</language>
    <atom:link href="https://example.com/rss/rss-en.xml" rel="self" type="application/rss+xml"/>
    <item>
      <title><![CDATA[Get Started]]></title>
      <link>https://example.com/docs/start</link>
      <description><![CDATA[A &lt;guide&gt; &amp; more]]></description>
      <pubDate>Thu, 15 Jan 2026 10:00:00 GMT</pubDate>
      <guid isPermaLink="true">https://example.com/docs/start</guid>
    </item>
    <item>
      <title><![CDATA[Old Page]]></title>
      <link>https://example.com/docs/legacy</link>
      <description><![CDATA[Legacy content]]></description>
      <pubDate>Mon, 01 Dec 2025 00:00:00 GMT</pubDate>
      <guid isPermaLink="true">https://example.com/docs/legacy</guid>
    </item>
  </channel>
</rss>`)
  })

  it('excludes draft routes from the feed', () => {
    const xml = generateRssXml(config, datedRoutes)
    expect(xml).not.toContain('Hidden Draft')
    expect(xml).not.toContain('/docs/draft')
  })

  it('strips the trailing slash from siteUrl in the channel link and item links', () => {
    const xml = generateRssXml(config, datedRoutes)
    expect(xml).toContain('<link>https://example.com</link>')
    expect(xml).toContain('<link>https://example.com/docs/start</link>')
    expect(xml).not.toContain('example.com/</link>')
  })

  it('uses route.date over route.lastUpdated when both are present', () => {
    const routes = [
      {
        path: '/docs/both',
        title: 'Both',
        date: '2026-03-01T00:00:00.000Z',
        lastUpdated: '2025-01-01T00:00:00.000Z',
      },
    ] as RouteMeta[]
    const xml = generateRssXml(config, routes)
    expect(xml).toContain('<pubDate>Sun, 01 Mar 2026 00:00:00 GMT</pubDate>')
  })

  it('omits the description element when neither excerpt nor description exists', () => {
    const routes = [{ path: '/docs/bare', title: 'Bare' }] as RouteMeta[]
    const xml = generateRssXml(config, routes)
    // Only the channel-level description remains — no item-level one.
    expect(xml.match(/<description>/g)).toHaveLength(1)
    expect(xml).not.toContain('<description><![CDATA[')
    expect(xml).toContain('<link>https://example.com/docs/bare</link>')
  })

  it('falls back to the current time for routes without any date', () => {
    const routes = [{ path: '/docs/fresh', title: 'Fresh' }] as RouteMeta[]
    const xml = generateRssXml(config, routes)
    const match = /<pubDate>(.+)<\/pubDate>/.exec(xml)
    expect(match).not.toBeNull()
    const parsed = Date.parse(match![1])
    expect(Number.isNaN(parsed)).toBe(false)
    expect(parsed).toBeGreaterThan(Date.parse('2026-01-01T00:00:00.000Z'))
  })

  it('escapes XML-special characters in titles inside CDATA', () => {
    const routes = [
      {
        path: '/docs/esc',
        title: '5 < 6 & 7 "quoted"',
        date: '2026-01-01T00:00:00.000Z',
      },
    ] as RouteMeta[]
    const xml = generateRssXml(config, routes)
    expect(xml).toContain(
      '<title><![CDATA[5 &lt; 6 &amp; 7 &quot;quoted&quot;]]></title>',
    )
  })

  it('keeps the self link aligned with the written file name for every locale', () => {
    const xml = generateRssXml({ ...config, locale: 'es' }, datedRoutes)
    expect(xml).toContain(
      '<atom:link href="https://example.com/rss/rss-es.xml" rel="self" type="application/rss+xml"/>',
    )
  })
})

describe('generateAtomXml', () => {
  it('renders a valid Atom feed with strict exact output', () => {
    const xml = generateAtomXml(config, datedRoutes)

    expect(xml).toBe(`<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">
  <title>My Docs</title>
  <link href="https://example.com" rel="alternate"/>
  <link href="https://example.com/rss/atom-en.xml" rel="self"/>
  <id>https://example.com</id>
  <updated>2026-01-15T10:00:00.000Z</updated>
  <entry>
    <title>Get Started</title>
    <link href="https://example.com/docs/start" rel="alternate"/>
    <id>https://example.com/docs/start</id>
    <updated>2026-01-15T10:00:00.000Z</updated>
    <summary>A &lt;guide&gt; &amp; more</summary>
  </entry>
  <entry>
    <title>Old Page</title>
    <link href="https://example.com/docs/legacy" rel="alternate"/>
    <id>https://example.com/docs/legacy</id>
    <updated>2025-12-01T00:00:00.000Z</updated>
    <summary>Legacy content</summary>
  </entry>
</feed>`)
  })

  it('uses the first item date as the feed updated timestamp', () => {
    const routes = [
      { path: '/docs/newer', title: 'Newer', date: '2026-06-01T00:00:00.000Z' },
      { path: '/docs/older', title: 'Older', date: '2025-06-01T00:00:00.000Z' },
    ] as RouteMeta[]
    const xml = generateAtomXml(config, routes)
    expect(xml).toContain('<updated>2026-06-01T00:00:00.000Z</updated>')
  })

  it('omits the summary element when no description exists', () => {
    const routes = [{ path: '/docs/bare', title: 'Bare' }] as RouteMeta[]
    const xml = generateAtomXml(config, routes)
    expect(xml).not.toContain('<summary>')
  })
})
