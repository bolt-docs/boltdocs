import { describe, it, expect } from 'vitest'
import { generateSearchData } from '../../src/node/search'

describe('search', () => {
  describe('generateSearchData', () => {
    it('should generate search documents from routes', () => {
      const routes = [
        {
          path: '/docs/intro',
          title: 'Introduction',
          _content: 'This is the introduction content',
          groupTitle: 'Getting Started',
          locale: 'en',
          version: 'v1',
          headings: [
            { level: 2, text: 'Overview', id: 'overview' },
            { level: 3, text: 'Installation', id: 'installation' },
          ],
        },
      ]

      const documents = generateSearchData(routes as any)

      expect(documents).toHaveLength(3) // 1 page + 2 headings

      // Main page document
      expect(documents[0]).toMatchObject({
        id: '/docs/intro',
        title: 'Introduction',
        content: 'This is the introduction content',
        url: '/docs/intro',
        display: 'Getting Started > Introduction',
        locale: 'en',
        version: 'v1',
      })

      // Heading documents
      expect(documents[1]).toMatchObject({
        id: '/docs/intro#overview',
        title: 'Overview',
        content: 'Overview in Introduction',
        url: '/docs/intro#overview',
        display: 'Introduction > Overview',
      })

      expect(documents[2]).toMatchObject({
        id: '/docs/intro#installation',
        title: 'Installation',
        url: '/docs/intro#installation',
        display: 'Introduction > Installation',
      })
    })

    it('should handle routes without headings', () => {
      const routes = [
        {
          path: '/docs/simple',
          title: 'Simple Page',
          _content: 'Simple content',
        },
      ]

      const documents = generateSearchData(routes as any)

      expect(documents).toHaveLength(1)
      expect(documents[0].title).toBe('Simple Page')
    })

    it('should handle routes without groupTitle', () => {
      const routes = [
        {
          path: '/docs/standalone',
          title: 'Standalone',
          _content: 'Content',
          headings: [],
        },
      ]

      const documents = generateSearchData(routes as any)

      expect(documents[0].display).toBe('Standalone')
    })

    it('should handle multiple routes with mixed configurations', () => {
      const routes = [
        {
          path: '/docs/page1',
          title: 'Page 1',
          _content: 'Content 1',
          groupTitle: 'Group A',
          locale: 'en',
          headings: [{ level: 2, text: 'Heading 1', id: 'h1' }],
        },
        {
          path: '/docs/page2',
          title: 'Page 2',
          _content: 'Content 2',
          locale: 'es',
          version: 'v2',
        },
      ]

      const documents = generateSearchData(routes as any)

      expect(documents).toHaveLength(3) // 2 pages + 1 heading

      expect(documents[0].locale).toBe('en')
      expect(documents[1].locale).toBe('en')
      expect(documents[2].locale).toBe('es')
      expect(documents[2].version).toBe('v2')
    })

    it('should handle empty content', () => {
      const routes = [
        {
          path: '/docs/empty',
          title: 'Empty',
          _content: '',
          headings: [],
        },
      ]

      const documents = generateSearchData(routes as any)

      expect(documents[0].content).toBe('')
    })

    it('should handle routes without _content', () => {
      const routes = [
        {
          path: '/docs/no-content',
          title: 'No Content',
          headings: [{ level: 2, text: 'Test', id: 'test' }],
        },
      ]

      const documents = generateSearchData(routes as any)

      expect(documents[0].content).toBe('')
      expect(documents).toHaveLength(2)
    })

    it('should handle multiple headings in a single route', () => {
      const routes = [
        {
          path: '/docs/multi',
          title: 'Multi',
          _content: 'content',
          headings: [
            { level: 2, text: 'H1', id: 'h1' },
            { level: 2, text: 'H2', id: 'h2' },
            { level: 3, text: 'H3', id: 'h3' },
          ],
        },
      ]

      const documents = generateSearchData(routes as any)

      expect(documents).toHaveLength(4) // 1 page + 3 headings
    })

    it('should generate correct URLs with anchors', () => {
      const routes = [
        {
          path: '/docs/guide',
          title: 'Guide',
          _content: 'content',
          headings: [
            { level: 2, text: 'Step One', id: 'step-one' },
            { level: 2, text: 'Step Two', id: 'step-two' },
          ],
        },
      ]

      const documents = generateSearchData(routes as any)

      expect(documents[1].url).toBe('/docs/guide#step-one')
      expect(documents[2].url).toBe('/docs/guide#step-two')
    })

    it('indexes controlled page content beyond the old 500-character limit', () => {
      const needle = 'needle-beyond-the-old-limit'
      const longContent = `${'x'.repeat(650)} ${needle} ${'y'.repeat(650)}`
      const documents = generateSearchData([
        { path: '/docs/long', title: 'Long', _content: longContent },
      ] as any)

      expect(documents[0].content.length).toBeGreaterThan(500)
      expect(documents[0].content).toContain(needle)
      expect(documents[0].content.length).toBeLessThanOrEqual(2_000)
    })

    it('maps deep section content to its heading document with bounded snippets', () => {
      const sectionNeedle = 'deep-section-needle'
      const content = [
        'Intro text',
        'Install',
        'z'.repeat(800),
        sectionNeedle,
        'z'.repeat(800),
        'Troubleshooting',
        'Short troubleshooting text',
      ].join(' ')

      const documents = generateSearchData([
        {
          path: '/docs/guide',
          title: 'Guide',
          _content: content,
          headings: [
            { level: 2, text: 'Install', id: 'install' },
            { level: 2, text: 'Troubleshooting', id: 'troubleshooting' },
          ],
        },
      ] as any)

      const install = documents.find((doc) => doc.id.endsWith('#install'))
      expect(install?.content).toContain(sectionNeedle)
      expect(install?.content.length).toBeLessThanOrEqual(1_200)
      expect(
        documents.reduce((total, doc) => total + doc.content.length, 0),
      ).toBeLessThanOrEqual(2_000 + 1_200 * 2)
    })

    it('caps total section payload for heading-heavy pages', () => {
      const headings = Array.from({ length: 100 }, (_, index) => ({
        level: 2,
        text: `Section ${index}`,
        id: `section-${index}`,
      }))
      const content = headings
        .flatMap((heading) => [heading.text, 'section-body '.repeat(100)])
        .join(' ')

      const documents = generateSearchData([
        {
          path: '/docs/heading-heavy',
          title: 'Heading heavy',
          _content: content,
          headings,
        } as any,
      ])
      const sectionPayload = documents
        .slice(1)
        .reduce((total, document) => total + document.content.length, 0)

      expect(sectionPayload).toBeLessThanOrEqual(6_000)
    })

    it('maps repeated heading text to successive sections', () => {
      const documents = generateSearchData([
        {
          path: '/docs/repeated',
          title: 'Repeated',
          _content: 'Example first unique-marker Example second unique-marker',
          headings: [
            { level: 2, text: 'Example', id: 'example' },
            { level: 2, text: 'Example', id: 'example-2' },
          ],
        },
      ] as any)

      expect(documents[1].content).toContain('first unique-marker')
      expect(documents[2].content).toContain('second unique-marker')
    })

    it('indexes custom frontmatter values into the page content', () => {
      const documents = generateSearchData([
        {
          path: '/docs/tagged',
          title: 'Tagged',
          _content: 'Base content',
          frontmatter: {
            tags: ['vite', 'plugin'],
            author: 'Jane Doe',
            rating: 5,
            seo: { keywords: 'ignored-standard-key' },
          },
        },
      ] as any)

      const doc = documents[0]
      expect(doc.content).toContain('Base content')
      expect(doc.content).toContain('vite plugin')
      expect(doc.content).toContain('Jane Doe')
      // Standard keys (title, seo, ...) must NOT be indexed as custom text.
      expect(doc.content).not.toContain('ignored-standard-key')
      expect(doc.content).not.toContain('tagged')
    })

    it('recursively flattens nested custom frontmatter objects and arrays', () => {
      const documents = generateSearchData([
        {
          path: '/docs/nested',
          title: 'Nested',
          _content: '',
          frontmatter: {
            meta: {
              custom: ['a', { deep: 'b' }],
            },
          },
        },
      ] as any)

      const content = documents[0].content
      expect(content).toContain('a')
      expect(content).toContain('b')
    })

    it('produces a strict full document shape for a page with headings', () => {
      const documents = generateSearchData([
        {
          path: '/docs/guide',
          title: 'Guide',
          _content: 'Some guide content',
          groupTitle: 'Basics',
          locale: 'en',
          version: 'v2',
          headings: [
            { level: 2, text: 'Setup', id: 'setup' },
            { level: 3, text: 'Troubleshooting', id: 'troubleshooting' },
          ],
        },
      ] as any)

      expect(documents).toEqual([
        {
          id: '/docs/guide',
          title: 'Guide',
          content: 'Some guide content',
          url: '/docs/guide',
          display: 'Basics > Guide',
          locale: 'en',
          version: 'v2',
        },
        {
          id: '/docs/guide#setup',
          title: 'Setup',
          content: 'Setup in Guide',
          url: '/docs/guide#setup',
          display: 'Guide > Setup',
          locale: 'en',
          version: 'v2',
        },
        {
          id: '/docs/guide#troubleshooting',
          title: 'Troubleshooting',
          content: 'Troubleshooting in Guide',
          url: '/docs/guide#troubleshooting',
          display: 'Guide > Troubleshooting',
          locale: 'en',
          version: 'v2',
        },
      ])
    })
  })
})
