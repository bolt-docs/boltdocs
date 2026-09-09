import { describe, expect, it } from 'vitest'
import {
  createArticleStructuredData,
  createBreadcrumbStructuredData,
  createStructuredData,
  createWebSiteStructuredData,
  defineStructuredData,
} from '../../src/shared/structured-data'

describe('structured data helpers', () => {
  it('creates reusable website JSON-LD without React dependencies', () => {
    const data = defineStructuredData(
      createWebSiteStructuredData({
        name: 'Example Docs',
        url: 'https://example.com',
        searchUrl: 'https://example.com/search?q=',
      }),
    )

    expect(data).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Example Docs',
      potentialAction: {
        '@type': 'SearchAction',
        'query-input': 'required name=search_term_string',
      },
    })
  })

  it('composes common graph nodes with the convenience factory', () => {
    const data = createStructuredData({
      website: { name: 'Example Docs', url: 'https://example.com' },
      article: {
        headline: 'Start here',
        url: 'https://example.com/start',
      },
      breadcrumbs: [
        { name: 'Docs', url: 'https://example.com/docs' },
        { name: 'Start', url: 'https://example.com/start' },
      ],
    })

    expect(Array.isArray(data)).toBe(true)
    expect(data).toHaveLength(3)
    expect(data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ '@type': 'WebSite' }),
        expect.objectContaining({ '@type': 'Article' }),
        expect.objectContaining({ '@type': 'BreadcrumbList' }),
      ]),
    )
  })

  it('rejects empty factories and invalid article dates', () => {
    expect(() => createStructuredData({})).toThrow(
      'createStructuredData() requires at least one',
    )
    expect(() =>
      createArticleStructuredData({
        headline: 'Invalid',
        url: 'https://example.com/invalid',
        datePublished: 'not-a-date',
      }),
    ).toThrow('Invalid datePublished value')
  })

  it('normalizes article dates and builds breadcrumb lists', () => {
    expect(
      createArticleStructuredData({
        headline: 'Getting Started',
        url: 'https://example.com/start',
        datePublished: '2026-01-01',
      }).datePublished,
    ).toBe('2026-01-01T00:00:00.000Z')

    expect(
      createBreadcrumbStructuredData([
        { name: 'Docs', url: 'https://example.com/docs' },
        { name: 'Start', url: 'https://example.com/start' },
      ]).itemListElement,
    ).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Docs',
        item: 'https://example.com/docs',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Start',
        item: 'https://example.com/start',
      },
    ])
  })
})
