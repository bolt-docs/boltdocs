import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  generateSearchData,
  type SearchDocument,
} from '../../src/node/search'

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
  })
})
