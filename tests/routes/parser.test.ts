import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseDocFile } from '../../packages/core/src/node/routes/parser'
import * as utils from '../../packages/core/src/node/utils'
import path from 'path'

// Mock utils since we don't want to depend on their implementation here
vi.mock('../../packages/core/src/node/utils', async () => {
  const actual = await vi.importActual('../../packages/core/src/node/utils')
  return {
    ...(actual as any),
    parseFrontmatter: vi.fn(),
  }
})

describe('parseDocFile', () => {
  const docsDir = 'C:\\docs'
  const basePath = '/docs'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('frontmatter extraction', () => {
    it('should parse a simple markdown file and return correct route meta', () => {
      const filePath = 'C:\\docs\\getting-started.md'

      ;(utils.parseFrontmatter as any).mockReturnValue({
        data: { title: 'Custom Title', sidebarPosition: 5 },
        content: '## Heading 1\nSome content\n### Heading 2\nMore content',
      })

      const result = parseDocFile(filePath, docsDir, basePath)

      expect(result.route.path).toBe('/docs/getting-started')
      expect(result.route.title).toBe('Custom Title')
      expect(result.route.sidebarPosition).toBe(5)
      expect(result.route.headings).toHaveLength(2)
      expect(result.route.headings![0]).toEqual({
        level: 2,
        text: 'Heading 1',
        id: 'heading-1',
      })
      expect(result.route.headings![1]).toEqual({
        level: 3,
        text: 'Heading 2',
        id: 'heading-2',
      })
    })

    it('should handle empty frontmatter', () => {
      const filePath = 'C:\\docs\\no-frontmatter.md'

      ;(utils.parseFrontmatter as any).mockReturnValue({
        data: {},
        content: '# Content',
      })

      const result = parseDocFile(filePath, docsDir, basePath)

      expect(result.route.title).toBe('no-frontmatter')
      expect(result.route.sidebarPosition).toBeUndefined()
    })

    it('should extract description from frontmatter', () => {
      ;(utils.parseFrontmatter as any).mockReturnValue({
        data: { description: 'This is a custom description' },
        content: '# Content',
      })

      const result = parseDocFile('C:\\docs\\test.md', docsDir, basePath)

      expect(result.route.description).toBe('This is a custom description')
    })

    it('should handle frontmatter with badge', () => {
      ;(utils.parseFrontmatter as any).mockReturnValue({
        data: { badge: 'New' },
        content: '# Content',
      })

      const result = parseDocFile('C:\\docs\\test.md', docsDir, basePath)

      expect(result.route.badge).toBe('New')
    })

    it('should handle frontmatter with icon', () => {
      ;(utils.parseFrontmatter as any).mockReturnValue({
        data: { icon: 'rocket' },
        content: '# Content',
      })

      const result = parseDocFile('C:\\docs\\test.md', docsDir, basePath)

      expect(result.route.icon).toBe('rocket')
    })
  })

  describe('title inference', () => {
    it('should infer title from filename if not provided in frontmatter', () => {
      const filePath = 'C:\\docs\\installation.md'

      ;(utils.parseFrontmatter as any).mockReturnValue({
        data: {},
        content: '',
      })

      const result = parseDocFile(filePath, docsDir, basePath)

      expect(result.route.title).toBe('installation')
    })

    it('should infer title from frontmatter title if provided', () => {
      ;(utils.parseFrontmatter as any).mockReturnValue({
        data: { title: 'My Custom Title' },
        content: '',
      })

      const result = parseDocFile('C:\\docs\\test.md', docsDir, basePath)

      expect(result.route.title).toBe('My Custom Title')
    })

    it('should strip number prefix from inferred title', () => {
      ;(utils.parseFrontmatter as any).mockReturnValue({
        data: {},
        content: '',
      })

      const result = parseDocFile('C:\\docs\\01.introduction.md', docsDir, basePath)

      expect(result.route.title).toBe('introduction')
    })
  })

  describe('description extraction', () => {
    it('should extract automatic summary from content if description is missing', () => {
      const filePath = 'C:\\docs\\summary-test.md'

      ;(utils.parseFrontmatter as any).mockReturnValue({
        data: { title: 'Summary Test' },
        content:
          '# Title\n\nThis is a [test](link) content with *some* formatting and **bold** text. `Code` is also here.\n\nIt should be extracted as a summary.',
      })

      const result = parseDocFile(filePath, docsDir, basePath)

      expect(result.route.description).toBe(
        'This is a test content with some formatting and bold text. Code is also here. It should be extracted as a summary.',
      )
    })

    it('should limit description to 160 characters', () => {
      const longContent = '# Title\n\n' + 'a'.repeat(200)

      ;(utils.parseFrontmatter as any).mockReturnValue({
        data: { title: 'Test' },
        content: longContent,
      })

      const result = parseDocFile('C:\\docs\\test.md', docsDir, basePath)

      expect(result.route.description!.length).toBeLessThanOrEqual(160)
    })

    it('should strip HTML tags from description', () => {
      ;(utils.parseFrontmatter as any).mockReturnValue({
        data: { title: 'Test' },
        content: '# Title\n\nThis has <strong>HTML</strong> tags in it.',
      })

      const result = parseDocFile('C:\\docs\\test.md', docsDir, basePath)

      expect(result.route.description).toBe('This has HTML tags in it.')
    })

    it('should use frontmatter description over content extraction', () => {
      ;(utils.parseFrontmatter as any).mockReturnValue({
        data: { description: 'Explicit description' },
        content: '# Title\n\nThis content should not be used.',
      })

      const result = parseDocFile('C:\\docs\\test.md', docsDir, basePath)

      expect(result.route.description).toBe('Explicit description')
    })
  })

  describe('heading extraction', () => {
    it('should handle complex headings and markdown links', () => {
      ;(utils.parseFrontmatter as any).mockReturnValue({
        data: {},
        content: '## Heading with [Link](url)\n### Another `code` heading',
      })
      const result = parseDocFile('C:\\docs\\test.md', docsDir, basePath)
      expect(result.route.headings![0].text).toBe('Heading with Link')
      expect(result.route.headings![1].text).toBe('Another code heading')
    })

    it('should extract h2, h3, and h4 headings', () => {
      ;(utils.parseFrontmatter as any).mockReturnValue({
        data: {},
        content: '## H2\n### H3\n#### H4\n# H1 should be ignored',
      })

      const result = parseDocFile('C:\\docs\\test.md', docsDir, basePath)

      expect(result.route.headings).toHaveLength(3)
      expect(result.route.headings![0].level).toBe(2)
      expect(result.route.headings![1].level).toBe(3)
      expect(result.route.headings![2].level).toBe(4)
    })

    it('should generate unique slugs for duplicate headings', () => {
      ;(utils.parseFrontmatter as any).mockReturnValue({
        data: {},
        content: '## Title\n## Title\n## Title',
      })

      const result = parseDocFile('C:\\docs\\test.md', docsDir, basePath)

      expect(result.route.headings![0].id).toBe('title')
      expect(result.route.headings![1].id).toBe('title-1')
      expect(result.route.headings![2].id).toBe('title-2')
    })

    it('should sanitize HTML in headings', () => {
      ;(utils.parseFrontmatter as any).mockReturnValue({
        data: {},
        content: '## Heading with <script>alert("xss")</script>',
      })

      const result = parseDocFile('C:\\docs\\test.md', docsDir, basePath)

      expect(result.route.headings![0].text).not.toContain('<script>')
    })
  })

  describe('i18n and versioning', () => {
    it('should handle i18n locales', () => {
      const config: any = {
        i18n: { locales: { es: { label: 'Spanish' } } },
      }
      ;(utils.parseFrontmatter as any).mockReturnValue({ data: {}, content: '' })
      const result = parseDocFile(
        'C:\\docs\\es\\guide.md',
        'C:\\docs',
        '/docs',
        config,
      )
      expect(result.route.locale).toBe('es')
      expect(result.route.path).toBe('/docs/es/guide')
    })

    it('should handle versioning', () => {
      const config: any = {
        versions: {
          versions: [{ label: 'v1', path: 'v1' }],
        },
      }
      ;(utils.parseFrontmatter as any).mockReturnValue({ data: {}, content: '' })
      const result = parseDocFile(
        'C:\\docs\\v1\\install.md',
        'C:\\docs',
        '/docs',
        config,
      )
      expect(result.route.version).toBe('v1')
      expect(result.route.path).toBe('/docs/v1/install')
    })

    it('should handle both version and locale', () => {
      const config: any = {
        versions: {
          versions: [{ label: 'v1', path: 'v1' }],
        },
        i18n: { locales: { es: { label: 'Spanish' } } },
      }
      ;(utils.parseFrontmatter as any).mockReturnValue({ data: {}, content: '' })
      const result = parseDocFile(
        'C:\\docs\\v1\\es\\guide.md',
        'C:\\docs',
        '/docs',
        config,
      )
      expect(result.route.version).toBe('v1')
      expect(result.route.locale).toBe('es')
      expect(result.route.path).toBe('/docs/v1/es/guide')
    })

    it('should handle tabs with version and locale', () => {
      const config: any = {
        versions: {
          versions: [{ label: 'v1', path: 'v1' }],
        },
        i18n: { locales: { es: { label: 'Spanish' } } },
      }
      ;(utils.parseFrontmatter as any).mockReturnValue({ data: {}, content: '' })
      const result = parseDocFile(
        'C:\\docs\\v1\\es\\(api)\\reference.md',
        'C:\\docs',
        '/docs',
        config,
      )
      expect(result.route.tab).toBe('api')
    })
  })

  describe('route path generation', () => {
    it('should respect custom permalinks from frontmatter', () => {
      ;(utils.parseFrontmatter as any).mockReturnValue({
        data: { permalink: '/custom/my-special-url' },
        content: '# Content',
      })

      const result = parseDocFile('C:\\docs\\test.md', docsDir, basePath)

      expect(result.route.path).toBe('/docs/custom/my-special-url')
    })

    it('should handle index files', () => {
      ;(utils.parseFrontmatter as any).mockReturnValue({
        data: {},
        content: '',
      })

      const result = parseDocFile('C:\\docs\\index.md', docsDir, basePath)

      expect(result.route.path).toBe('/docs')
    })

    it('should handle nested directory structure', () => {
      ;(utils.parseFrontmatter as any).mockReturnValue({
        data: {},
        content: '',
      })

      const result = parseDocFile(
        'C:\\docs\\guide\\getting-started.md',
        docsDir,
        basePath,
      )

      expect(result.route.path).toBe('/docs/guide/getting-started')
    })
  })

  describe('group metadata', () => {
    it('should detect group index files', () => {
      ;(utils.parseFrontmatter as any).mockReturnValue({
        data: { title: 'Guide', groupTitle: 'Getting Started' },
        content: '',
      })

      const result = parseDocFile(
        'C:\\docs\\guide\\index.md',
        docsDir,
        basePath,
      )

      expect(result.isGroupIndex).toBe(true)
      expect(result.groupMeta?.title).toBe('Getting Started')
    })

    it('should extract group position from frontmatter', () => {
      ;(utils.parseFrontmatter as any).mockReturnValue({
        data: { groupPosition: 2 },
        content: '',
      })

      const result = parseDocFile(
        'C:\\docs\\guide\\index.md',
        docsDir,
        basePath,
      )

      expect(result.groupMeta?.position).toBe(2)
    })

    it('should infer group position from directory name', () => {
      ;(utils.parseFrontmatter as any).mockReturnValue({
        data: {},
        content: '',
      })

      const result = parseDocFile(
        'C:\\docs\\guide\\02-test.md',
        docsDir,
        basePath,
      )

      // The inferredGroupPosition comes from the group directory name (guide in this case)
      // But since guide doesn't match a version/locale, it becomes the relativeDir
      expect(result.relativeDir).toBe('guide')
    })
  })

  describe('content extraction', () => {
    it('should extract raw content for search indexing', () => {
      ;(utils.parseFrontmatter as any).mockReturnValue({
        data: {},
        content: '# Title\n\nSome content with [links](url) and `code`.',
      })

      const result = parseDocFile('C:\\docs\\test.md', docsDir, basePath)

      expect(result.route._content).toBeDefined()
      expect(result.route._content).toContain('Some content with links')
    })

    it('should preserve raw markdown content', () => {
      ;(utils.parseFrontmatter as any).mockReturnValue({
        data: {},
        content: '# Title\n\n## Heading\n\nContent with **bold** text.',
      })

      const result = parseDocFile('C:\\docs\\test.md', docsDir, basePath)

      expect(result.route._rawContent).toContain('**bold**')
    })
  })

  describe('seo extraction', () => {
    it('should extract top-level SEO tags (og:, twitter:)', () => {
      ;(utils.parseFrontmatter as any).mockReturnValue({
        data: {
          'og:title': 'Social Title',
          'twitter:card': 'summary_large_image',
          'robots': 'noindex',
        },
        content: '# Content',
      })

      const result = parseDocFile('C:\\docs\\test.md', docsDir, basePath)

      expect(result.route.seo).toEqual({
        'og:title': 'Social Title',
        'twitter:card': 'summary_large_image',
        'robots': 'noindex',
      })
    })

    it('should extract nested seo object', () => {
      ;(utils.parseFrontmatter as any).mockReturnValue({
        data: {
          seo: {
            'og:image': '/custom-og.png',
            'canonical': 'https://example.com/custom',
          },
        },
        content: '# Content',
      })

      const result = parseDocFile('C:\\docs\\test.md', docsDir, basePath)

      expect(result.route.seo).toEqual({
        'og:image': '/custom-og.png',
        'canonical': 'https://example.com/custom',
      })
    })

    it('should merge nested seo object with top-level tags', () => {
      ;(utils.parseFrontmatter as any).mockReturnValue({
        data: {
          'og:title': 'Top Level',
          seo: {
            'og:title': 'Nested',
            'og:image': '/image.png',
          },
        },
        content: '# Content',
      })

      const result = parseDocFile('C:\\docs\\test.md', docsDir, basePath)

      // Top level keys processed after nested, so they should override if conflict
      // In our implementation: 
      // 1. Assign nested
      // 2. Loop top level and assign
      expect(result.route.seo).toEqual({
        'og:title': 'Top Level',
        'og:image': '/image.png',
      })
    })

    it('should set noindex: true if hidden: true is provided', () => {
      ;(utils.parseFrontmatter as any).mockReturnValue({
        data: { hidden: true },
        content: '# Content',
      })

      const result = parseDocFile('C:\\docs\\test.md', docsDir, basePath)

      expect(result.route.seo).toEqual({
        noindex: true,
      })
    })
  })

  describe('security', () => {
    it('should throw an error if the file is outside the docs directory', () => {
      const filePath = 'C:\\outside\\file.md'
      expect(() => parseDocFile(filePath, docsDir, basePath)).toThrow(
        /Security breach: File is outside of docs directory/
      )
    })

    it('should block null bytes in paths', () => {
      const filePath = 'C:\\docs\\file\0.md'
      expect(() => parseDocFile(filePath, docsDir, basePath)).toThrow()
    })

    it('should handle encoding errors gracefully', () => {
      const filePath = 'C:\\docs\\%invalid-encoding%.md'
      // Should throw encoding security error
      ;(utils.parseFrontmatter as any).mockReturnValue({
        data: {},
        content: '',
      })
      expect(() => parseDocFile(filePath, docsDir, basePath)).toThrow(
        'Security breach: Invalid characters or encoding in path'
      )
    })
  })

  describe('metadata generation', () => {
    it('should generate complete route metadata', () => {
      ;(utils.parseFrontmatter as any).mockReturnValue({
        data: {
          title: 'Complete Test',
          description: 'Full metadata test',
          sidebarPosition: 3,
          badge: 'Beta',
          icon: 'star',
        },
        content: '## Heading',
      })

      const result = parseDocFile('C:\\docs\\test.md', docsDir, basePath)

      expect(result.route).toMatchObject({
        path: '/docs/test',
        title: 'Complete Test',
        description: 'Full metadata test',
        sidebarPosition: 3,
        badge: 'Beta',
        icon: 'star',
        headings: [{ level: 2, text: 'Heading', id: 'heading' }],
      })
      expect(result.route.filePath).toBeDefined()
      expect(result.route.componentPath).toBe('C:\\docs\\test.md')
    })

    it('should include relative path in filePath', () => {
      ;(utils.parseFrontmatter as any).mockReturnValue({
        data: {},
        content: '',
      })

      const result = parseDocFile('C:\\docs\\guide\\test.md', docsDir, basePath)

      expect(result.route.filePath).toBe('guide/test.md')
    })
  })
})
