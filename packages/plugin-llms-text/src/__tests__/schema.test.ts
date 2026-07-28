import { describe, it, expect } from 'vitest'
import {
  LlmsTextPluginOptionsSchema,
  LlmsTextSectionSchema,
} from '../node/schema'

describe('LlmsTextSectionSchema', () => {
  it('accepts a valid section', () => {
    const result = LlmsTextSectionSchema.parse({
      title: 'Getting Started',
      pathPrefix: '/docs/getting-started',
    })
    expect(result.title).toBe('Getting Started')
    expect(result.pathPrefix).toBe('/docs/getting-started')
    expect(result.optional).toBe(false) // default
  })

  it('accepts section with all optional fields', () => {
    const result = LlmsTextSectionSchema.parse({
      title: 'Blog',
      pathPrefix: '/blog/',
      description: 'Blog posts and announcements.',
      maxLinks: 10,
      optional: true,
    })
    expect(result.optional).toBe(true)
    expect(result.maxLinks).toBe(10)
    expect(result.description).toBe('Blog posts and announcements.')
  })

  it('rejects empty title', () => {
    expect(() =>
      LlmsTextSectionSchema.parse({ title: '', pathPrefix: '/docs' }),
    ).toThrow()
  })

  it('rejects empty pathPrefix', () => {
    expect(() =>
      LlmsTextSectionSchema.parse({ title: 'Docs', pathPrefix: '' }),
    ).toThrow()
  })

  it('rejects description exceeding max length', () => {
    expect(() =>
      LlmsTextSectionSchema.parse({
        title: 'Docs',
        pathPrefix: '/docs',
        description: 'x'.repeat(501),
      }),
    ).toThrow()
  })
})

describe('LlmsTextPluginOptionsSchema', () => {
  it('accepts empty options with defaults', () => {
    const result = LlmsTextPluginOptionsSchema.parse({})
    expect(result.sortBy).toBe('sidebarPosition')
    expect(result.includeDrafts).toBe(false)
    expect(result.devMode).toBe(false)
    expect(result.addLinkTag).toBe(true)
  })

  it('accepts fully custom options', () => {
    const result = LlmsTextPluginOptionsSchema.parse({
      title: 'Custom Title',
      description: 'Custom description.',
      bodyText: 'Some LLM instructions.',
      sortBy: 'title',
      maxLinksPerSection: 50,
      includeDrafts: true,
      devMode: true,
      addLinkTag: false,
      baseUrl: 'https://custom.dev',
      sections: [
        { title: 'API', pathPrefix: '/api/' },
        { title: 'Blog', pathPrefix: '/blog/', optional: true },
      ],
    })
    expect(result.title).toBe('Custom Title')
    expect(result.sortBy).toBe('title')
    expect(result.sections).toHaveLength(2)
    expect(result.baseUrl).toBe('https://custom.dev')
  })

  it('rejects invalid sortBy value', () => {
    expect(() =>
      LlmsTextPluginOptionsSchema.parse({ sortBy: 'invalid' }),
    ).toThrow()
  })

  it('rejects negative maxLinksPerSection', () => {
    expect(() =>
      LlmsTextPluginOptionsSchema.parse({ maxLinksPerSection: -1 }),
    ).toThrow()
  })

  it('rejects invalid baseUrl', () => {
    expect(() =>
      LlmsTextPluginOptionsSchema.parse({ baseUrl: 'not-a-url' }),
    ).toThrow()
  })

  it('accepts includePaths and excludePaths filters', () => {
    const result = LlmsTextPluginOptionsSchema.parse({
      includePaths: ['/docs', '/blog'],
      excludePaths: ['/blog/experimental'],
    })
    expect(result.includePaths).toEqual(['/docs', '/blog'])
    expect(result.excludePaths).toEqual(['/blog/experimental'])
  })
})
