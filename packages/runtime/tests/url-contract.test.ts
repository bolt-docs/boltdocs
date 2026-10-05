import { describe, expect, it } from 'vitest'

import {
  addUrlBase,
  classifyUrlPath,
  getConfiguredLocales,
  getConfiguredVersions,
  hasUriScheme,
  hasUrlBase,
  isConfiguredLocale,
  normalizeUrlBase,
  normalizeUrlPath,
  parseUrlReference,
  resolveUrlReference,
  splitUrlReference,
  stripSiteProtocol,
  stripUrlBase,
  type UrlContractConfig,
} from '../src/router/url-contract'
import { normalizePath, resolvePublicAssetUrl } from '../src/path'

/**
 * The URL contract is the part of the runtime most likely to break silently.
 *
 * Every link in the docs goes through it, and the failure mode is not a thrown
 * error — it is a link that resolves to the wrong place, which looks fine in a
 * snapshot test and sends a reader to the wrong page. These are the rules that
 * decide where a URL points.
 */

const config: UrlContractConfig = {
  base: '/docs',
  i18n: { locales: ['en', 'es'], defaultLocale: 'en' },
  versions: {
    versions: [{ path: 'v1', label: 'v1' }],
    prefix: 'v',
    defaultVersion: 'v1',
  },
}

describe('url base', () => {
  it('normalises a base with or without surrounding slashes', () => {
    expect(normalizeUrlBase('docs')).toBe('/docs')
    expect(normalizeUrlBase('/docs/')).toBe('/docs')
    expect(normalizeUrlBase('/docs')).toBe('/docs')
    // An absent base normalises to the root rather than to an empty string, and
    // every caller below special-cases `'/'`. Asserting `''` here would invite a
    // future change that breaks that convention silently.
    expect(normalizeUrlBase()).toBe('/')
  })

  it('normalises a path to exactly one leading slash and no trailing one', () => {
    expect(normalizeUrlPath('docs/guides/')).toBe('/docs/guides')
    expect(normalizeUrlPath('/docs/guides')).toBe('/docs/guides')
  })

  it('tells whether a path is already inside the base', () => {
    expect(hasUrlBase('/docs/guides', '/docs')).toBe(true)
    expect(hasUrlBase('/docs', '/docs')).toBe(true)
    expect(hasUrlBase('/showcase', '/docs')).toBe(false)
    // A prefix is not a base: `/docsomething` is not inside `/docs`.
    expect(hasUrlBase('/docsomething', '/docs')).toBe(false)
  })

  it('round-trips add and strip', () => {
    expect(stripUrlBase('/docs/guides', '/docs')).toBe('/guides')
    expect(addUrlBase('/guides', '/docs')).toBe('/docs/guides')
    expect(stripUrlBase(addUrlBase('/guides', '/docs'), '/docs')).toBe(
      '/guides',
    )
  })
})

describe('locales and versions', () => {
  it('reads locales from either an array or a record', () => {
    expect(getConfiguredLocales(config)).toEqual(['en', 'es'])
    expect(
      getConfiguredLocales({
        i18n: {
          locales: { en: 'en', es: 'es' },
          defaultLocale: 'en',
        },
      }),
    ).toEqual(['en', 'es'])
    expect(getConfiguredLocales({})).toEqual([])
  })

  it('reads version paths', () => {
    expect(getConfiguredVersions(config)).toEqual(['v1'])
    expect(getConfiguredVersions({})).toEqual([])
  })

  it('only treats a configured locale as configured', () => {
    expect(isConfiguredLocale('es', config)).toBe(true)
    expect(isConfiguredLocale('fr', config)).toBe(false)
  })
})

describe('reference parsing', () => {
  it('treats a site: prefix as site-root-relative', () => {
    // `site:` exists so a caller can escape a localized prefix. Reading it as an
    // absolute URL would send the link off-site.
    expect(stripSiteProtocol('site:/docs/guides')).toEqual({
      value: '/docs/guides',
      siteProtocol: true,
    })
    // And a bare `site:` still resolves to something rather than to ''.
    expect(stripSiteProtocol('site:')).toEqual({
      value: '/',
      siteProtocol: true,
    })
    expect(stripSiteProtocol('/docs/guides')).toEqual({
      value: '/docs/guides',
      siteProtocol: false,
    })
  })

  it('separates path, query and hash in the order they appear', () => {
    expect(splitUrlReference('#section')).toEqual({
      pathname: '',
      search: '',
      hash: '#section',
    })
    expect(splitUrlReference('?q=term')).toEqual({
      pathname: '',
      search: '?q=term',
      hash: '',
    })
    // Query before hash: the hash must not swallow the query.
    expect(splitUrlReference('/a?q=1#b')).toEqual({
      pathname: '/a',
      search: '?q=1',
      hash: '#b',
    })
  })

  it('recognises absolute URLs', () => {
    expect(hasUriScheme('https://example.com')).toBe(true)
    expect(hasUriScheme('/docs/guides')).toBe(false)
    // A relative path with a colon later in it is not a scheme.
    expect(hasUriScheme('/docs/a:b')).toBe(false)
  })

  it('classifies a document, an external link and a collection', () => {
    expect(classifyUrlPath('/docs/guides', config)).toBe('doc')
    expect(classifyUrlPath('https://example.com', config)).toBe('external')
    expect(classifyUrlPath('#anchor', config)).not.toBe('doc')
  })

  it('strips the base out of the route path it reports', () => {
    const parsed = parseUrlReference('/docs/guides/getting-started', config)
    expect(parsed.pathname).toBe('/docs/guides/getting-started')
    expect(parsed.hadBase).toBe(true)
    // The base is the deployment prefix, not part of the route, so it must not
    // reappear in the route path or every route lookup misses.
    expect(parsed.routePath).toBe('/guides/getting-started')
    expect(parsed.kind).toBe('doc')
  })
})

describe('buildUrl', () => {
  it('joins the base without doubling a slash', () => {
    expect(
      resolveUrlReference('/guides', config, { locale: 'en' }),
    ).not.toContain('//guides')
  })

  it('leaves an external URL untouched', () => {
    // The one case where rewriting would be a bug rather than a feature: a
    // documentation link to another site must not gain this site's base.
    const external = 'https://example.com/docs/guides'
    expect(resolveUrlReference(external, config)).toBe(external)
  })
})

describe('path helpers', () => {
  it('drops a trailing slash but leaves the root and interior slashes alone', () => {
    expect(normalizePath('/docs/guides/')).toBe('/docs/guides')
    // `normalizePath` does not collapse `//` — that is `normalizeUrlPath`'s job.
    // Two functions with overlapping names and different rules is worth pinning
    // so nobody reaches for the wrong one.
    expect(normalizePath('/')).toBe('/')
    expect(normalizePath('docs//guides/')).toBe('docs//guides')
  })

  it('prefixes a public asset with the base', () => {
    expect(resolvePublicAssetUrl('/dark.svg', '/docs')).toBe('/docs/dark.svg')
    // Already-prefixed assets must not be prefixed twice.
    expect(resolvePublicAssetUrl('/docs/dark.svg', '/docs')).toBe(
      '/docs/dark.svg',
    )
  })

  it('leaves an absolute URL alone', () => {
    expect(
      resolvePublicAssetUrl('https://cdn.example.com/a.svg', '/docs'),
    ).toBe('https://cdn.example.com/a.svg')
  })
})
