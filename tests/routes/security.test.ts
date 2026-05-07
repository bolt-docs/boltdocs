import fs from 'node:fs'
import { describe, it, expect, vi } from 'vitest'
import { parseDocFile } from '../../packages/core/src/node/routes/parser'
import * as utils from '../../packages/core/src/node/utils'
import {
  SecurityViolationError,
  PathTraversalError,
  EncodingSecurityError,
  ValidationError,
} from '../../packages/core/src/node/errors'
import { ParserCache } from '../../packages/core/src/node/routes/parser/cache'

// Mock utils for security testing
vi.mock('../../packages/core/src/node/utils', async () => {
  const actual = (await vi.importActual(
    '../../packages/core/src/node/utils',
  )) as any
  return {
    ...actual,
    parseFrontmatter: vi.fn(),
    parseFrontmatterAsync: vi.fn(),
  }
})

describe('Security: Route Parser', () => {
  const docsDir = 'C:\\docs'
  const basePath = '/docs'

  beforeEach(() => {
    ParserCache.clear()
    vi.clearAllMocks()
  })

  it('should reflect the path provided without allowing traversal in the route (Functional Check)', async () => {
    const maliciousPath = 'C:\\docs\\..\\..\\windows\\system32\\cmd.exe'

    vi.mocked(utils.parseFrontmatterAsync).mockResolvedValue({
      data: {},
      content: '',
    })

    // The parser should now throw an error if the file is outside docsDir
    await expect(
      parseDocFile(maliciousPath, docsDir, basePath),
    ).rejects.toThrow(PathTraversalError)
    await expect(
      parseDocFile(maliciousPath, docsDir, basePath),
    ).rejects.toThrow(/Security breach/)
  })

  it('should handle malicious frontmatter keys', async () => {
    vi.mocked(utils.parseFrontmatterAsync).mockResolvedValue({
      data: {
        __proto__: { admin: true },
        constructor: { prototype: { hacked: true } },
      },
      content: '',
    })

    const result = await parseDocFile('C:\\docs\\test.md', docsDir, basePath)

    // Ensure the route object isn't compromised by prototype pollution
    expect((result.route as any).admin).toBeUndefined()
    expect((Object.prototype as any).hacked).toBeUndefined()
  })

  it('should handle extremely long values in frontmatter', async () => {
    const longTitle = 'A'.repeat(1000000)
    vi.mocked(utils.parseFrontmatterAsync).mockResolvedValue({
      data: { title: longTitle },
      content: '',
    })

    const result = await parseDocFile('C:\\docs\\test.md', docsDir, basePath)
    expect(result.route.title).toBe(longTitle)
  })

  it('should allow paths with route groups (parentheses)', async () => {
    const routeGroupPath = 'C:\\docs\\(guides)\\overview.md'
    vi.mocked(utils.parseFrontmatterAsync).mockResolvedValue({
      data: { title: 'Overview' },
      content: '# Overview',
    })

    const result = await parseDocFile(routeGroupPath, docsDir, basePath)
    expect(result.route.title).toBe('Overview')
    expect(result.route.path).toBe('/docs/guides/overview')
  })

  describe('Advanced Path Traversal', () => {
    it('should block null byte injection', async () => {
      const malicious = 'C:\\docs\\secret.md\0.txt'
      ;(utils.parseFrontmatterAsync as any).mockResolvedValue({
        data: {},
        content: '',
      })
      await expect(parseDocFile(malicious, docsDir, basePath)).rejects.toThrow()
    })

    it('should block URL encoded traversal', async () => {
      const malicious = 'C:\\docs\\%2e%2e\\%2e%2e\\windows\\system32\\cmd.exe'
      vi.mocked(utils.parseFrontmatterAsync).mockResolvedValue({
        data: {},
        content: '',
      })
      await expect(parseDocFile(malicious, docsDir, basePath)).rejects.toThrow(
        SecurityViolationError,
      )
    })

    it('should handle mixed separators and repetitive dots', async () => {
      const malicious = 'C:\\docs\\..././..\\..\\secret.txt'
      vi.mocked(utils.parseFrontmatterAsync).mockResolvedValue({
        data: {},
        content: '',
      })
      await expect(parseDocFile(malicious, docsDir, basePath)).rejects.toThrow(
        PathTraversalError,
      )
    })
  })

  describe('XSS Injection', () => {
    it('should detect XSS in metadata fields', async () => {
      const xssScript = "<script>alert('xss')</script>"
      ;(utils.parseFrontmatterAsync as any).mockResolvedValue({
        data: {
          title: `Title ${xssScript}`,
          description: `Desc ${xssScript}`,
          badge: xssScript,
        },
        content: '',
      })

      const result = await parseDocFile('C:\\docs\\test.md', docsDir, basePath)

      expect(result.route.title).not.toContain('<script>')
      expect(result.route.description).not.toContain('<script>')
      expect(result.route.badge).not.toContain('<script>')
    })

    it('should detect XSS in headings with malicious payloads', async () => {
      const xssPayload = '<img src=x onerror=alert(1)>'
      vi.mocked(utils.parseFrontmatterAsync).mockResolvedValue({
        data: {},
        content: `## Normal Heading\n### Malicious ${xssPayload}`,
      })

      const result = await parseDocFile('C:\\docs\\test.md', docsDir, basePath)
      expect(result.route.headings![1].text).not.toContain('<img')
      expect(result.route.headings![1].text).not.toContain('onerror')
      expect(result.route.headings![1].text).toBe('Malicious')
    })
  })

  describe('ReDoS (Regular Expression Denial of Service)', () => {
    it('should not hang on maliciously crafted headings', async () => {
      const start = Date.now()
      const maliciousContent = '## ' + ' '.repeat(10000) + 'A'

      vi.mocked(utils.parseFrontmatterAsync).mockResolvedValue({
        data: {},
        content: maliciousContent,
      })

      await parseDocFile('C:\\docs\\test.md', docsDir, basePath)
      const duration = Date.now() - start
      expect(duration).toBeLessThan(100)
    })
  })

  describe('Whitelisting and Length', () => {
    it('should block paths exceeding MAX_PATH_LENGTH', async () => {
      const longPath = 'C:\\docs\\' + 'a'.repeat(300) + '.md'
      vi.mocked(utils.parseFrontmatterAsync).mockResolvedValue({
        data: {},
        content: '',
      })
      await expect(parseDocFile(longPath, docsDir, basePath)).rejects.toThrow(
        PathTraversalError,
      )
    })

    it('should block paths with invalid characters', async () => {
      const invalidPath = 'C:\\docs\\hacked<>.md'
      vi.mocked(utils.parseFrontmatterAsync).mockResolvedValue({
        data: {},
        content: '',
      })
      await expect(
        parseDocFile(invalidPath, docsDir, basePath),
      ).rejects.toThrow(PathTraversalError)
    })
  })

  describe('Frontmatter Security', () => {
    const tempMd = './temp_security_test.md'

    it('should respect MAX_FRONTMATTER_SIZE', async () => {
      const largeYaml = 'title: ' + 'A'.repeat(utils.MAX_FRONTMATTER_SIZE + 1)
      const content = `---\n${largeYaml}\n---\nContent`

      const realUtils = (await vi.importActual(
        '../../packages/core/src/node/utils',
      )) as any
      vi.mocked(utils.parseFrontmatterAsync).mockImplementationOnce(
        realUtils.parseFrontmatterAsync,
      )

      fs.writeFileSync(tempMd, content)
      await expect(utils.parseFrontmatterAsync(tempMd)).rejects.toThrow(
        ValidationError,
      )
      if (fs.existsSync(tempMd)) fs.unlinkSync(tempMd)
    })

    it('should preserve unknown fields via Zod schema (extensibility support)', async () => {
      const yaml = 'title: Valid Title\nunknown: Invalid Field'
      const content = `---\n${yaml}\n---\nContent`

      const realUtils = (await vi.importActual(
        '../../packages/core/src/node/utils',
      )) as any
      vi.mocked(utils.parseFrontmatterAsync).mockImplementationOnce(
        realUtils.parseFrontmatterAsync,
      )

      fs.writeFileSync(tempMd, content)
      const { data } = await utils.parseFrontmatterAsync(tempMd)
      expect(data.title).toBe('Valid Title')
      expect((data as any).unknown).toBe('Invalid Field')
      if (fs.existsSync(tempMd)) fs.unlinkSync(tempMd)
    })

    it('should sanitize title and description in frontmatter', async () => {
      const yaml =
        'title: "<script>alert(1)</script>Title"\ndescription: "<b>Bold</b> Desc"'
      const content = `---\n${yaml}\n---\nContent`

      const realUtils = (await vi.importActual(
        '../../packages/core/src/node/utils',
      )) as any
      vi.mocked(utils.parseFrontmatterAsync).mockImplementationOnce(
        realUtils.parseFrontmatterAsync,
      )

      fs.writeFileSync(tempMd, content)
      const { data } = await utils.parseFrontmatterAsync(tempMd)
      expect(data.title).not.toContain('<script>')
      expect(data.description).not.toContain('<b>')
      if (fs.existsSync(tempMd)) fs.unlinkSync(tempMd)
    })
  })

  describe('Unicode and Encoding Bypass', () => {
    it('should block Unicode dot variants (e.g. One Dot Leader)', async () => {
      const malicious = docsDir + '\\\u2024\u2024\\windows'
      await expect(parseDocFile(malicious, docsDir, basePath)).rejects.toThrow(
        SecurityViolationError,
      )
    })

    it('should block double URL encoding', async () => {
      const malicious = docsDir + '\\..%252f..%252fwindows'
      await expect(parseDocFile(malicious, docsDir, basePath)).rejects.toThrow(
        SecurityViolationError,
      )
    })
  })

  describe('Fuzzing and Control Characters', () => {
    it('should block newline characters in paths', async () => {
      const malicious = docsDir + '\\test\nfile.md'
      await expect(parseDocFile(malicious, docsDir, basePath)).rejects.toThrow(
        SecurityViolationError,
      )
    })

    it('should block carriage return in paths', async () => {
      const malicious = docsDir + '\\test\rfile.md'
      await expect(parseDocFile(malicious, docsDir, basePath)).rejects.toThrow(
        SecurityViolationError,
      )
    })

    it('should block tab characters in paths', async () => {
      const malicious = docsDir + '\\test\tfile.md'
      await expect(parseDocFile(malicious, docsDir, basePath)).rejects.toThrow(
        SecurityViolationError,
      )
    })
  })

  describe('Sanitization utility', () => {
    it('should sanitize dangerous filenames', () => {
      expect(utils.sanitizeFilename('hacked!..md')).toBe('hacked.md')
      expect(utils.sanitizeFilename('test/../../../etc/passwd')).toBe(
        'test/etc/passwd',
      )
    })
  })

  describe('Advanced XSS and Protocol Filtering', () => {
    it('should block dangerous URL protocols in links', async () => {
      vi.mocked(utils.parseFrontmatterAsync).mockResolvedValue({
        data: { title: 'Test' },
        content:
          '<a href="javascript:alert(1)">Click me</a><a href="data:text/html,<html>">Data</a>',
      })
      const result = await parseDocFile('C:\\docs\\test.md', docsDir, basePath)
      expect(result.route._rawContent).toContain('href="javascript:') // In raw it exists

      // But when we sanitize metadata (if title used it) or use sanitizeHtml elsewhere
      const sanitized = utils.sanitizeHtml(
        '<a href="javascript:alert(1)">Click me</a>',
      )
      expect(sanitized).not.toContain('href="javascript:')
    })

    it('should block prohibited tags', () => {
      const complexHtml =
        '<div>Safe</div><iframe></iframe><script></script><object></object>'
      const sanitized = utils.sanitizeHtml(complexHtml)
      expect(sanitized).toContain('<div>Safe</div>')
      expect(sanitized).not.toContain('<iframe')
      expect(sanitized).not.toContain('<script')
      expect(sanitized).not.toContain('<object')
    })

    it('should strip event handlers', () => {
      const html = '<div onclick="alert(1)" onmouseover="run()">Content</div>'
      const sanitized = utils.sanitizeHtml(html)
      expect(sanitized).not.toContain('onclick')
      expect(sanitized).not.toContain('onmouseover')
    })
  })
})
