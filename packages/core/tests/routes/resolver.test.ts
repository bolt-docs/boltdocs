import { describe, expect, it } from 'vitest'
import { resolveRoutePath } from '../../src/node/routes/parser/resolver'

describe('resolveRoutePath canonical URL contract', () => {
  const docsDir = '/project/docs'

  it('resolves version before locale for documentation paths', () => {
    const result = resolveRoutePath(
      '/project/docs/releases/v2/es/guides/start.md',
      docsDir,
      '/docs',
      {
        versions: {
          defaultVersion: 'v2',
          prefix: 'releases/',
          versions: [{ label: 'v2', path: 'v2' }],
        },
        i18n: {
          defaultLocale: 'en',
          locales: { en: 'English', es: 'Spanish' },
        },
      },
    )

    expect(result.version).toBe('v2')
    expect(result.locale).toBe('es')
    expect(result.finalPath).toBe('/docs/releases/v2/es/guides/start')
  })

  it('resolves versioned collection paths as version/locale/collection/post', () => {
    const result = resolveRoutePath(
      '/project/docs/releases/v2/es/[blog]/hello-world.md',
      docsDir,
      '/docs',
      {
        versions: {
          defaultVersion: 'v2',
          prefix: 'releases/',
          versions: [{ label: 'v2', path: 'v2' }],
        },
        i18n: {
          defaultLocale: 'en',
          locales: { en: 'English', es: 'Spanish' },
        },
      },
    )

    expect(result.collection).toBe('blog')
    expect(result.version).toBe('v2')
    expect(result.locale).toBe('es')
    expect(result.finalPath).toBe('/releases/v2/es/blog/hello-world')
  })

  it('normalizes a collection _index.md to the collection root', () => {
    const result = resolveRoutePath(
      '/project/docs/[blog]/_index.md',
      docsDir,
      '/docs',
    )

    expect(result.collection).toBe('blog')
    expect(result.finalPath).toBe('/blog')
  })

  it('supports a textual version prefix such as v + 1', () => {
    const result = resolveRoutePath(
      '/project/docs/v1/guide.md',
      docsDir,
      '/docs',
      {
        versions: {
          defaultVersion: '1',
          prefix: 'v',
          versions: [{ label: 'v1', path: '1' }],
        },
      },
    )

    expect(result.version).toBe('1')
    expect(result.finalPath).toBe('/docs/v1/guide')
  })
})
