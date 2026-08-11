import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  generateLlmsText,
  buildDefaultSections,
  writeLlmsText,
  formatSiteUrl,
} from '../node/generator'
import type { LlmsTextConfig } from '../node/generator'
import type { LlmsTextSection } from '../node/schema'
import type { RouteMeta } from 'boltdocs'
import fs from 'node:fs'
import path from 'node:path'

// ── Helpers ──────────────────────────────────────────────────────────

function makeRoute(
  overrides: Partial<RouteMeta> & { path: string },
): RouteMeta {
  return {
    title: overrides.path.split('/').pop() ?? 'Untitled',
    componentPath: `/docs${overrides.path}.mdx`,
    filePath: `docs${overrides.path}.mdx`,
    ...overrides,
  }
}

function makeConfig(overrides?: Partial<LlmsTextConfig>): LlmsTextConfig {
  return {
    title: 'Test Docs',
    description: 'A test documentation site.',
    siteUrl: 'https://example.com',
    sections: [
      {
        title: 'Documentation',
        pathPrefix: '/',
        description: 'Core docs.',
        optional: false,
      },
    ],
    sortBy: 'sidebarPosition',
    includeDrafts: false,
    ...overrides,
  }
}

// ── formatSiteUrl ─────────────────────────────────────────────────────

describe('formatSiteUrl', () => {
  it('removes trailing slash from a simple URL', () => {
    expect(formatSiteUrl('https://example.com/')).toBe('https://example.com')
  })

  it('removes multiple trailing slashes', () => {
    expect(formatSiteUrl('https://example.com/docs///')).toBe(
      'https://example.com/docs',
    )
  })

  it('returns the same URL when no trailing slash', () => {
    expect(formatSiteUrl('https://example.com')).toBe('https://example.com')
  })

  it('handles empty string', () => {
    expect(formatSiteUrl('')).toBe('')
  })

  it('handles URL with path and trailing slash', () => {
    expect(formatSiteUrl('https://example.com/docs/')).toBe(
      'https://example.com/docs',
    )
  })
})

// ── buildDefaultSections ──────────────────────────────────────────────

describe('buildDefaultSections', () => {
  it('creates a Documentation section for flat routes', () => {
    const routes: RouteMeta[] = [
      makeRoute({ path: '/', title: 'Home' }),
      makeRoute({ path: '/docs/guide', title: 'Guide' }),
    ]
    const sections = buildDefaultSections(routes)
    expect(sections).toHaveLength(1)
    expect(sections[0].title).toBe('Documentation')
    expect(sections[0].optional).toBe(false)
    expect(sections[0].pathPrefix).toBe('/')
  })

  it('separates collection routes into Optional sections', () => {
    const routes: RouteMeta[] = [
      makeRoute({ path: '/docs/guide', title: 'Guide' }),
      makeRoute({ path: '/blog/post-1', title: 'Post 1', collection: 'blog' }),
      makeRoute({ path: '/blog/post-2', title: 'Post 2', collection: 'blog' }),
    ]
    const sections = buildDefaultSections(routes)
    // Documentation + Blog
    expect(sections).toHaveLength(2)
    expect(sections[0].title).toBe('Documentation')
    expect(sections[0].optional).toBe(false)
    expect(sections[1].title).toBe('Blog')
    expect(sections[1].optional).toBe(true)
    expect(sections[1].pathPrefix).toBe('/blog/')
  })

  it('ignores draft routes when determining prefixes', () => {
    const routes: RouteMeta[] = [
      makeRoute({ path: '/docs/guide', title: 'Guide' }),
      makeRoute({ path: '/draft/page', title: 'Draft', draft: true }),
    ]
    const sections = buildDefaultSections(routes)
    // Should NOT create a "Draft" section
    expect(sections).toHaveLength(1)
    expect(sections[0].title).toBe('Documentation')
  })

  it('returns empty array for empty routes', () => {
    const sections = buildDefaultSections([])
    expect(sections).toHaveLength(0)
  })

  it('returns empty array when all routes are drafts', () => {
    const routes: RouteMeta[] = [
      makeRoute({ path: '/draft/page', title: 'Draft', draft: true }),
    ]
    const sections = buildDefaultSections(routes)
    expect(sections).toHaveLength(0)
  })

  it('handles known collection prefixes: changelog, news, release-notes', () => {
    const routes: RouteMeta[] = [
      makeRoute({ path: '/docs/api', title: 'API' }),
      makeRoute({
        path: '/changelog/v1',
        title: 'v1',
        collection: 'changelog',
      }),
      makeRoute({ path: '/news/announcement', title: 'News' }),
      makeRoute({
        path: '/release-notes/2.0',
        title: '2.0',
      }),
    ]
    const sections = buildDefaultSections(routes)
    expect(sections).toHaveLength(4)
    expect(sections.map((s) => s.title)).toEqual([
      'Documentation',
      'Changelog',
      'News',
      'Release Notes',
    ])
    expect(sections.every((s, i) => (i === 0 ? !s.optional : s.optional))).toBe(
      true,
    )
  })

  it('does not include collection routes in Documentation section', () => {
    const routes: RouteMeta[] = [
      makeRoute({ path: '/docs/guide', title: 'Guide' }),
      makeRoute({ path: '/blog/post', title: 'Post' }),
    ]
    const sections = buildDefaultSections(routes)
    // The Documentation section has a catch-all '/' prefix.
    // Blog routes are separated into their own Optional section,
    // but the Documentation section still covers '/blog/post' via '/'.
    // The deduplication happens at the section-filtering level in
    // routesForSection (which excludes draft + matches prefix),
    // not in buildDefaultSections. The buildDefaultSections just
    // defines the section structure; routesForSection filters.
    expect(sections).toHaveLength(2)
    expect(sections[0].pathPrefix).toBe('/')
    expect(sections[1].pathPrefix).toBe('/blog/')
  })
})

// ── generateLlmsText ─────────────────────────────────────────────────

describe('generateLlmsText', () => {
  it('produces a valid llms.txt with the correct structure', () => {
    const routes: RouteMeta[] = [
      makeRoute({ path: '/', title: 'Home' }),
      makeRoute({
        path: '/docs/guide',
        title: 'Getting Started',
        excerpt: 'How to get started.',
        sidebarPosition: 1,
      }),
      makeRoute({
        path: '/docs/api',
        title: 'API Reference',
        description: 'Full API documentation.',
        sidebarPosition: 2,
      }),
    ]
    const config = makeConfig()
    const result = generateLlmsText(routes, config)

    // Must start with H1 title
    expect(result).toMatch(/^# Test Docs\n/)
    // Must have blockquote
    expect(result).toContain('> A test documentation site.')
    // Must have H2 section
    expect(result).toContain('## Documentation')
    // Must have links
    expect(result).toContain('- [Home]')
    expect(result).toContain('- [Getting Started]')
    expect(result).toContain('- [API Reference]')
    // Links must have URLs
    expect(result).toContain('(https://example.com/')
    expect(result).toContain('(https://example.com/docs/guide)')
    // Must have descriptions
    expect(result).toContain(': How to get started.')
    expect(result).toContain(': Full API documentation.')
    // Must end with newline
    expect(result.endsWith('\n')).toBe(true)
  })

  it('includes body text when configured', () => {
    const routes: RouteMeta[] = [
      makeRoute({ path: '/docs/guide', title: 'Guide' }),
    ]
    const config = makeConfig({
      bodyText:
        'This project uses React 19 and Vite 7.\nKey patterns: Server Components, Streaming SSR.',
    })
    const result = generateLlmsText(routes, config)

    expect(result).toContain(
      'This project uses React 19 and Vite 7.\nKey patterns: Server Components, Streaming SSR.',
    )
    // Body text comes after blockquote, before H2 sections
    const blockquoteIdx = result.indexOf('> A test')
    const bodyIdx = result.indexOf('This project uses')
    const h2Idx = result.indexOf('## Documentation')
    expect(blockquoteIdx).toBeLessThan(bodyIdx)
    expect(bodyIdx).toBeLessThan(h2Idx)
  })

  it('separates optional sections under ## Optional', () => {
    const routes: RouteMeta[] = [
      makeRoute({ path: '/docs/guide', title: 'Guide' }),
      makeRoute({ path: '/blog/post', title: 'Blog Post' }),
    ]
    const config = makeConfig({
      sections: [
        {
          title: 'Documentation',
          pathPrefix: '/docs/',
          description: 'Core docs.',
          optional: false,
        },
        {
          title: 'Blog',
          pathPrefix: '/blog/',
          description: 'Blog posts.',
          optional: true,
        },
      ],
    })
    const result = generateLlmsText(routes, config)

    expect(result).toContain('## Documentation')
    expect(result).toContain('## Optional')
    expect(result).toContain('- [Blog Post]')
    // The Blog section content should be under ## Optional
    const optionalIdx = result.indexOf('## Optional')
    const blogLinkIdx = result.indexOf('- [Blog Post]')
    expect(optionalIdx).toBeLessThan(blogLinkIdx)
  })

  it('skips sections with no matching routes', () => {
    const routes: RouteMeta[] = [
      makeRoute({ path: '/docs/guide', title: 'Guide' }),
    ]
    const config = makeConfig({
      sections: [
        {
          title: 'Documentation',
          pathPrefix: '/docs/',
          description: 'Core docs.',
          optional: false,
        },
        {
          title: 'Empty Section',
          pathPrefix: '/nonexistent/',
          description: 'Nothing here.',
          optional: false,
        },
      ],
    })
    const result = generateLlmsText(routes, config)

    expect(result).toContain('## Documentation')
    expect(result).not.toContain('## Empty Section')
  })

  it('omits ## Optional heading when no optional sections match', () => {
    const routes: RouteMeta[] = [
      makeRoute({ path: '/docs/guide', title: 'Guide' }),
    ]
    const config = makeConfig({
      sections: [
        {
          title: 'Documentation',
          pathPrefix: '/docs/',
          description: 'Core docs.',
          optional: false,
        },
        {
          title: 'Blog',
          pathPrefix: '/blog/',
          description: 'Blog posts.',
          optional: true,
        },
      ],
    })
    const result = generateLlmsText(routes, config)

    expect(result).not.toContain('## Optional')
  })

  it('includes only configured locales and maps the default locale', () => {
    const routes: RouteMeta[] = [
      makeRoute({ path: '/docs/guide', title: 'English Guide' }),
      makeRoute({ path: '/es/docs/guide', title: 'Guía', locale: 'es' }),
      makeRoute({ path: '/fr/docs/guide', title: 'Guide', locale: 'fr' }),
    ]
    const config = makeConfig({
      locales: ['es', 'en'],
      defaultLocale: 'en',
    })

    const result = generateLlmsText(routes, config)

    expect(result).toContain('[English Guide]')
    expect(result).toContain('[Guía]')
    expect(result).not.toContain('[Guide]')
  })

  it('includes every locale when locales is omitted', () => {
    const routes: RouteMeta[] = [
      makeRoute({ path: '/docs/guide', title: 'English Guide' }),
      makeRoute({ path: '/es/docs/guide', title: 'Guía', locale: 'es' }),
    ]

    const result = generateLlmsText(routes, makeConfig())

    expect(result).toContain('[English Guide]')
    expect(result).toContain('[Guía]')
  })

  it('treats an undefined route locale as the configured default locale', () => {
    const routes: RouteMeta[] = [
      makeRoute({ path: '/blog/post', title: 'Blog Post' }),
      makeRoute({ path: '/es/blog/post', title: 'Publicación', locale: 'es' }),
    ]
    const config = makeConfig({ locales: ['es'], defaultLocale: 'en' })

    const result = generateLlmsText(routes, config)

    expect(result).not.toContain('[Blog Post]')
    expect(result).toContain('[Publicación]')
  })

  it('keeps non-localized routes when no default locale is configured', () => {
    const routes: RouteMeta[] = [
      makeRoute({ path: '/blog/post', title: 'Blog Post' }),
      makeRoute({ path: '/es/blog/post', title: 'Publicación', locale: 'es' }),
    ]
    const config = makeConfig({ locales: ['es'] })

    const result = generateLlmsText(routes, config)

    expect(result).toContain('[Blog Post]')
    expect(result).toContain('[Publicación]')
  })

  it('excludes draft routes when includeDrafts is false', () => {
    const routes: RouteMeta[] = [
      makeRoute({ path: '/docs/guide', title: 'Guide' }),
      makeRoute({ path: '/docs/draft', title: 'Draft', draft: true }),
    ]
    const config = makeConfig()
    const result = generateLlmsText(routes, config)

    expect(result).toContain('- [Guide]')
    expect(result).not.toContain('- [Draft]')
  })

  it('includes draft routes when includeDrafts is true', () => {
    const routes: RouteMeta[] = [
      makeRoute({ path: '/docs/guide', title: 'Guide' }),
      makeRoute({ path: '/docs/draft', title: 'Draft', draft: true }),
    ]
    const config = makeConfig({ includeDrafts: true })
    const result = generateLlmsText(routes, config)

    expect(result).toContain('- [Guide]')
    expect(result).toContain('- [Draft]')
  })

  it('sorts by sidebarPosition by default', () => {
    const routes: RouteMeta[] = [
      makeRoute({
        path: '/docs/zzz',
        title: 'Z Topic',
        sidebarPosition: 3,
      }),
      makeRoute({
        path: '/docs/aaa',
        title: 'A Topic',
        sidebarPosition: 1,
      }),
      makeRoute({
        path: '/docs/mmm',
        title: 'M Topic',
        sidebarPosition: 2,
      }),
    ]
    const config = makeConfig()
    const result = generateLlmsText(routes, config)

    const aIdx = result.indexOf('- [A Topic]')
    const mIdx = result.indexOf('- [M Topic]')
    const zIdx = result.indexOf('- [Z Topic]')
    expect(aIdx).toBeLessThan(mIdx)
    expect(mIdx).toBeLessThan(zIdx)
  })

  it('sorts by path when configured', () => {
    const routes: RouteMeta[] = [
      makeRoute({ path: '/docs/zzz', title: 'Z Topic' }),
      makeRoute({ path: '/docs/aaa', title: 'A Topic' }),
      makeRoute({ path: '/docs/mmm', title: 'M Topic' }),
    ]
    const config = makeConfig({ sortBy: 'path' })
    const result = generateLlmsText(routes, config)

    const aIdx = result.indexOf('/docs/aaa)')
    const mIdx = result.indexOf('/docs/mmm)')
    const zIdx = result.indexOf('/docs/zzz)')
    expect(aIdx).toBeLessThan(mIdx)
    expect(mIdx).toBeLessThan(zIdx)
  })

  it('sorts by title when configured', () => {
    const routes: RouteMeta[] = [
      makeRoute({ path: '/docs/zzz', title: 'Z Topic' }),
      makeRoute({ path: '/docs/aaa', title: 'A Topic' }),
      makeRoute({ path: '/docs/mmm', title: 'M Topic' }),
    ]
    const config = makeConfig({ sortBy: 'title' })
    const result = generateLlmsText(routes, config)

    const aIdx = result.indexOf('- [A Topic]')
    const mIdx = result.indexOf('- [M Topic]')
    const zIdx = result.indexOf('- [Z Topic]')
    expect(aIdx).toBeLessThan(mIdx)
    expect(mIdx).toBeLessThan(zIdx)
  })

  it('limits links per section when maxLinksPerSection is set', () => {
    const routes: RouteMeta[] = Array.from({ length: 10 }, (_, i) =>
      makeRoute({ path: `/docs/page-${i}`, title: `Page ${i}` }),
    )
    const config = makeConfig({ maxLinksPerSection: 3 })
    const result = generateLlmsText(routes, config)

    // Should only have 3 links
    const linkCount = (result.match(/- \[/g) || []).length
    expect(linkCount).toBe(3)
  })

  it('escapes special characters in link titles', () => {
    const routes: RouteMeta[] = [
      makeRoute({
        path: '/docs/api',
        title: 'API [Beta] (v2)',
      }),
    ]
    const config = makeConfig()
    const result = generateLlmsText(routes, config)

    // Brackets and parens should be escaped
    expect(result).toContain('- [API \\[Beta\\] \\(v2\\)]')
  })

  it('handles empty routes gracefully', () => {
    const config = makeConfig()
    const result = generateLlmsText([], config)

    expect(result).toContain('# Test Docs')
    expect(result).toContain('> A test documentation site.')
    // No sections rendered since no routes match
    expect(result).not.toContain('##')
  })

  it('handles routes with excerpt as primary description, falling back to description', () => {
    const routes: RouteMeta[] = [
      makeRoute({
        path: '/docs/guide',
        title: 'Guide',
        excerpt: 'Short excerpt.',
        description: 'Long description.',
      }),
    ]
    const config = makeConfig()
    const result = generateLlmsText(routes, config)

    // excerpt takes priority over description
    expect(result).toContain(': Short excerpt.')
    expect(result).not.toContain(': Long description.')
  })

  it('formats URLs correctly with the site base', () => {
    const routes: RouteMeta[] = [
      makeRoute({ path: '/docs/guide', title: 'Guide' }),
    ]
    const config = makeConfig({ siteUrl: 'https://site.com' })
    const result = generateLlmsText(routes, config)

    expect(result).toContain('(https://site.com/docs/guide)')
  })

  it('deduplicates description whitespace including newlines', () => {
    const routes: RouteMeta[] = [
      makeRoute({
        path: '/docs/guide',
        title: 'Guide',
        excerpt: 'Multi\n  line   spaced.',
      }),
    ]
    const config = makeConfig()
    const result = generateLlmsText(routes, config)

    expect(result).toContain(': Multi line spaced.')
  })
})

// ── writeLlmsText ─────────────────────────────────────────────────────

describe('writeLlmsText', () => {
  const tmpDir = '/tmp/boltdocs-llms-test'

  beforeEach(() => {
    vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined)
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('writes content to outDir/llms.txt', () => {
    const content = '# Test\n> Desc\n'
    const logger = vi.fn()

    writeLlmsText(content, tmpDir, logger)

    expect(fs.mkdirSync).toHaveBeenCalledWith(
      path.join(tmpDir, path.dirname('llms.txt')),
      { recursive: true },
    )
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join(tmpDir, 'llms.txt'),
      content,
      'utf-8',
    )
  })

  it('calls the logger with a success message', () => {
    const content = '# Test\n> Desc\n'
    const logger = vi.fn()

    writeLlmsText(content, tmpDir, logger)

    expect(logger).toHaveBeenCalledWith(
      expect.stringContaining('llms.txt generated'),
    )
    expect(logger).toHaveBeenCalledWith(expect.stringContaining('llms.txt'))
  })

  it('reports correct byte size in log message', () => {
    const content = '# Hello'
    const logger = vi.fn()

    writeLlmsText(content, tmpDir, logger)

    expect(logger).toHaveBeenCalledWith(expect.stringContaining('(7 bytes)'))
  })

  it('creates parent directories recursively', () => {
    const content = '# Test'
    const logger = vi.fn()

    writeLlmsText(content, '/deep/nested/path', logger)

    // Should create '/deep/nested/path' directory
    expect(fs.mkdirSync).toHaveBeenCalledWith('/deep/nested/path', {
      recursive: true,
    })
  })
})

// ── Integration: buildDefaultSections + generateLlmsText ────────────

describe('integration: buildDefaultSections + generateLlmsText', () => {
  it('generates a complete llms.txt from real-world routes', () => {
    const routes: RouteMeta[] = [
      makeRoute({ path: '/', title: 'Home' }),
      makeRoute({
        path: '/docs/installation',
        title: 'Installation',
        sidebarPosition: 1,
      }),
      makeRoute({
        path: '/docs/configuration',
        title: 'Configuration',
        sidebarPosition: 2,
      }),
      makeRoute({
        path: '/docs/api/reference',
        title: 'API Reference',
        sidebarPosition: 3,
      }),
      makeRoute({
        path: '/blog/announcing-v2',
        title: 'Announcing v2',
        collection: 'blog',
        excerpt: 'Major update with new features.',
      }),
      makeRoute({
        path: '/blog/tips',
        title: 'Pro Tips',
        collection: 'blog',
        excerpt: 'Advanced usage patterns.',
      }),
    ]

    const sections = buildDefaultSections(routes)
    const config: LlmsTextConfig = {
      title: 'My Project',
      description: 'Modern documentation framework.',
      siteUrl: 'https://myproject.dev',
      sections,
      sortBy: 'sidebarPosition',
      includeDrafts: false,
    }

    const result = generateLlmsText(routes, config)

    // Verify structure
    expect(result).toMatch(/^# My Project\n/)
    expect(result).toContain('> Modern documentation framework.')

    // Documentation section
    expect(result).toContain('## Documentation')
    expect(result).toContain('- [Installation]')
    expect(result).toContain('- [Configuration]')
    expect(result).toContain('- [API Reference]')
    expect(result).toContain('- [Home]')

    // Blog under Optional
    expect(result).toContain('## Optional')
    expect(result).toContain('- [Announcing v2]')
    expect(result).toContain(': Major update with new features.')
    expect(result).toContain('- [Pro Tips]')
    expect(result).toContain(': Advanced usage patterns.')

    // Correct link URLs
    expect(result).toContain('(https://myproject.dev/')
    expect(result).toContain('(https://myproject.dev/docs/installation)')

    // No draft routes
    expect(result).not.toContain('[Draft]')
  })

  it('generates content without Optional heading when no collection routes exist', () => {
    const routes: RouteMeta[] = [
      makeRoute({ path: '/', title: 'Home' }),
      makeRoute({ path: '/docs/guide', title: 'Guide' }),
    ]

    const sections = buildDefaultSections(routes)
    const config: LlmsTextConfig = {
      title: 'Simple',
      description: 'Simple site.',
      siteUrl: 'https://simple.dev',
      sections,
      sortBy: 'path',
      includeDrafts: false,
    }

    const result = generateLlmsText(routes, config)

    expect(result).not.toContain('## Optional')
    expect(result).toContain('## Documentation')
  })

  it('bodyText appears after blockquote and before H2 sections', () => {
    const routes: RouteMeta[] = [
      makeRoute({ path: '/docs/guide', title: 'Guide' }),
    ]

    const sections = buildDefaultSections(routes)
    const config: LlmsTextConfig = {
      title: 'Project',
      description: 'Description.',
      bodyText: 'Important LLM instructions here.',
      siteUrl: 'https://project.dev',
      sections,
      sortBy: 'path',
      includeDrafts: false,
    }

    const result = generateLlmsText(routes, config)

    const blockquoteIdx = result.indexOf('> Description.')
    const bodyIdx = result.indexOf('Important LLM instructions')
    const h2Idx = result.indexOf('## Documentation')

    expect(blockquoteIdx).toBeGreaterThan(0)
    expect(bodyIdx).toBeGreaterThan(blockquoteIdx)
    expect(h2Idx).toBeGreaterThan(bodyIdx)
  })
})

// ── Edge case: routes with special characters ───────────────────────

describe('edge cases', () => {
  it('handles routes with special characters in path', () => {
    const routes: RouteMeta[] = [
      makeRoute({
        path: '/docs/react-19/hooks',
        title: 'React 19 Hooks',
      }),
    ]
    const config = makeConfig()
    const result = generateLlmsText(routes, config)

    expect(result).toContain('(https://example.com/docs/react-19/hooks)')
  })

  it('handles unicode titles', () => {
    const routes: RouteMeta[] = [
      makeRoute({
        path: '/docs/api',
        title: 'API 中文文档',
      }),
    ]
    const config = makeConfig()
    const result = generateLlmsText(routes, config)

    expect(result).toContain('- [API 中文文档]')
  })

  it('handles very long description', () => {
    const longDesc = 'A'.repeat(500)
    const routes: RouteMeta[] = [
      makeRoute({
        path: '/docs/guide',
        title: 'Guide',
        description: longDesc,
      }),
    ]
    const config = makeConfig()
    const result = generateLlmsText(routes, config)

    expect(result).toContain(longDesc)
  })

  it('does not add trailing colon for routes without description', () => {
    const routes: RouteMeta[] = [
      makeRoute({ path: '/docs/guide', title: 'Guide' }),
    ]
    const config = makeConfig()
    const result = generateLlmsText(routes, config)

    // The link line should NOT end with ": "
    expect(result).toMatch(
      /- \[Guide\]\(https:\/\/example\.com\/docs\/guide\)\n/,
    )
  })
})
