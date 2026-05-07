import { describe, it, expect, vi } from 'vitest'
import {
  normalizePath,
  stripNumberPrefix,
  extractNumberPrefix,
  isDocFile,
  getFileMtime,
  parseFrontmatter,
  parseFrontmatterAsync,
  escapeHtml,
  escapeXml,
  fileToRoutePath,
  sanitizeFilename,
  capitalize,
  stripHtmlTags,
  logSecurityEvent,
  getCacheConfig,
} from '../packages/core/src/node/utils'
import fs from 'fs'
import path from 'path'
import os from 'os'

describe('utils', () => {
  describe('Path & File Utils', () => {
    it('normalizePath should convert backslashes to forward slashes', () => {
      expect(normalizePath('foo\\bar\\baz')).toBe('foo/bar/baz')
      expect(normalizePath('C:\\docs\\test.md')).toBe('C:/docs/test.md')
      expect(normalizePath('C:/docs\\test.md')).toBe('C:/docs/test.md')
    })

    it('stripNumberPrefix should remove numeric prefixes', () => {
      expect(stripNumberPrefix('1.guide')).toBe('guide')
      expect(stripNumberPrefix('10.advanced')).toBe('advanced')
      expect(stripNumberPrefix('01.introduction.md')).toBe('introduction.md')
      expect(stripNumberPrefix('01-introduction.md')).toBe('01-introduction.md')
    })

    it('extractNumberPrefix should extract numeric prefixes', () => {
      expect(extractNumberPrefix('1.guide')).toBe(1)
      expect(extractNumberPrefix('10.advanced')).toBe(10)
      expect(extractNumberPrefix('01.introduction.md')).toBe(1)
      expect(extractNumberPrefix('guide')).toBeUndefined()
    })

    it('isDocFile should identify md/mdx files', () => {
      expect(isDocFile('test.md')).toBe(true)
      expect(isDocFile('test.mdx')).toBe(true)
      expect(isDocFile('/path/to/test.md')).toBe(true)
      expect(isDocFile('test.txt')).toBe(false)
    })

    it('getFileMtime should return mtime or 0 on error', () => {
      const tempFile = path.join(
        os.tmpdir(),
        `boltdocs-utils-test-${Date.now()}.txt`,
      )
      fs.writeFileSync(tempFile, 'hello')
      expect(getFileMtime(tempFile)).toBeGreaterThan(0)
      expect(getFileMtime('nonexistent')).toBe(0)
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile)
    })

    it('sanitizeFilename should remove dangerous characters', () => {
      expect(sanitizeFilename('test<file>.md')).toBe('testfile.md')
      expect(sanitizeFilename('test?file.md')).toBe('testfile.md')
      expect(sanitizeFilename('../etc/passwd')).toBe('etc/passwd')
    })
  })

  describe('Content Parsing & Escaping', () => {
    it('parseFrontmatter should parse YAML frontmatter', () => {
      const tempFile = path.join(
        os.tmpdir(),
        `boltdocs-utils-test-fm-${Date.now()}.md`,
      )
      fs.writeFileSync(tempFile, '---\ntitle: Hello\n---\n# World')
      const { data, content } = parseFrontmatter(tempFile)
      expect(data.title).toBe('Hello')
      expect(content.trim()).toBe('# World')
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile)
    })

    it('parseFrontmatterAsync should parse YAML frontmatter asynchronously', async () => {
      const tempFile = path.join(
        os.tmpdir(),
        `boltdocs-utils-test-fm-async-${Date.now()}.md`,
      )
      fs.writeFileSync(tempFile, '---\ntitle: Hello Async\n---\n# Async World')
      const { data, content } = await parseFrontmatterAsync(tempFile)
      expect(data.title).toBe('Hello Async')
      expect(content.trim()).toBe('# Async World')
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile)
    })

    it('escapeHtml and escapeXml should escape special characters', () => {
      const raw = '<script src="bad.js">&</script>'
      const escaped =
        '&lt;script src=&quot;bad.js&quot;&gt;&amp;&lt;/script&gt;'
      expect(escapeHtml(raw)).toBe(escaped)
      expect(escapeXml(raw)).toBe(escaped)
    })

    it('stripHtmlTags should remove all HTML tags but keep content', () => {
      expect(stripHtmlTags('<p>text</p>')).toBe('text')
      expect(stripHtmlTags('<div class="test">content</div>')).toBe('content')
      expect(stripHtmlTags('<p><strong>bold</strong></p>')).toBe('bold')
    })
  })

  describe('Routing & UI Utils', () => {
    it('fileToRoutePath should convert relative paths to routes', () => {
      expect(fileToRoutePath('1.guide/2.advanced.md')).toBe('/guide/advanced')
      expect(fileToRoutePath('index.md')).toBe('/')
      expect(fileToRoutePath('guide/index.md')).toBe('/guide')
      expect(fileToRoutePath('docs/page.md')).toBe('/docs/page')
    })

    it('capitalize should uppercase the first letter', () => {
      expect(capitalize('hello')).toBe('Hello')
      expect(capitalize('')).toBe('')
      expect(capitalize('a')).toBe('A')
    })
  })

  describe('System & Config Utils', () => {
    it('logSecurityEvent should be a function', () => {
      expect(typeof logSecurityEvent).toBe('function')
    })

    it('getCacheConfig should read from process.env', () => {
      const original = process.env.BOLTDOCS_NO_CACHE

      process.env.BOLTDOCS_NO_CACHE = '1'
      expect(getCacheConfig().noCache).toBe(true)

      process.env.BOLTDOCS_NO_CACHE = '0'
      expect(getCacheConfig().noCache).toBe(false)

      if (original === undefined) delete process.env.BOLTDOCS_NO_CACHE
      else process.env.BOLTDOCS_NO_CACHE = original
    })
  })
})
