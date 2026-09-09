import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  collectOutputBreakdown,
  describeCacheState,
  findConfiguredDevRoute,
  normalizeDevRoute,
  summarizeSamples,
} from './baseline-utils'

describe('summarizeSamples', () => {
  it('computes stable aggregate statistics without mutating input', () => {
    const values = [9, 1, 5, 3, 7]

    expect(summarizeSamples(values)).toMatchObject({
      count: 5,
      min: 1,
      max: 9,
      mean: 5,
      median: 5,
      p95: 9,
    })
    expect(values).toEqual([9, 1, 5, 3, 7])
  })

  it('uses the upper sample for even-count percentiles', () => {
    expect(summarizeSamples([10, 20, 30, 40])).toMatchObject({
      median: 25,
      p95: 40,
    })
  })

  it('returns an empty summary for no samples', () => {
    expect(summarizeSamples([])).toEqual({
      samples: [],
      count: 0,
      min: 0,
      max: 0,
      mean: 0,
      median: 0,
      p95: 0,
      standardDeviation: 0,
    })
  })
})

describe('benchmark cache state', () => {
  it('makes framework cache policy explicit without claiming dependency isolation', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-cache-state-'))
    try {
      fs.symlinkSync(os.tmpdir(), path.join(root, 'node_modules'))
      expect(describeCacheState(root, 'cold-framework')).toMatchObject({
        mode: 'cold-framework',
        clearedPaths: ['dist', '.boltdocs', '.cache', '.vite'],
        dependencyCache: 'shared',
      })
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('dev route helpers', () => {
  it('normalizes explicit routes without changing the root route', () => {
    expect(normalizeDevRoute('')).toBe('/')
    expect(normalizeDevRoute('/')).toBe('/')
    expect(normalizeDevRoute('docs/')).toBe('/docs')
    expect(normalizeDevRoute('//docs///')).toBe('/docs')
  })

  it('detects literal config bases and falls back for dynamic bases', () => {
    expect(findConfiguredDevRoute("export default { base: '/docs/' }")).toBe(
      '/docs',
    )
    expect(findConfiguredDevRoute('export default { base: basePath }')).toBe(
      '/',
    )
  })
})

describe('collectOutputBreakdown', () => {
  it('classifies deployable files and counts HTML pages', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-output-test-'))
    try {
      fs.mkdirSync(path.join(root, 'assets'), { recursive: true })
      fs.writeFileSync(path.join(root, 'index.html'), 'page')
      fs.writeFileSync(path.join(root, 'docs.html'), 'page-two')
      fs.writeFileSync(path.join(root, 'assets', 'app.js'), 'console.log(1)')
      fs.writeFileSync(path.join(root, 'assets', 'site.css'), 'body{}')
      fs.writeFileSync(path.join(root, 'assets', 'logo.svg'), '<svg />')
      fs.writeFileSync(path.join(root, 'assets', 'font.woff2'), 'font')
      fs.writeFileSync(path.join(root, 'robots.txt'), 'User-agent: *')

      const result = collectOutputBreakdown(root)

      expect(result.total.files).toBe(7)
      expect(result.html).toMatchObject({ files: 2, bytes: 12 })
      expect(result.javascript.files).toBe(1)
      expect(result.css.files).toBe(1)
      expect(result.images.files).toBe(1)
      expect(result.fonts.files).toBe(1)
      expect(result.other.files).toBe(1)
      expect(result.htmlPages).toBe(2)
      expect(result.contentDigest).toMatch(/^[a-f0-9]{64}$/)
      expect(result.compressed.gzipBytes).toBeGreaterThan(0)
      expect(result.compressed.brotliBytes).toBeGreaterThan(0)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
