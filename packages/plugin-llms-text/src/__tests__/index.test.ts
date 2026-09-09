import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import llmsTextPlugin from '../node/index'

// Mock createPlugin to inspect what it receives
vi.mock('boltdocs', () => ({
  createPlugin: vi.fn((config: unknown) => config),
  default: {},
}))

interface TestLogger {
  info: ReturnType<typeof vi.fn>
}

interface TestContext {
  config: Record<string, unknown>
  routes: Array<Record<string, unknown>>
  outDir: string
  logger: TestLogger
}

function makeTestContext(
  outDir: string,
  overrides: Record<string, unknown> = {},
): TestContext {
  return {
    config: {
      siteUrl: 'https://example.com',
      theme: {
        title: 'My Docs',
        description: 'My description.',
      },
    },
    routes: [
      { path: '/docs/guide', title: 'Guide', filePath: 'docs/guide.mdx' },
      { path: '/', title: 'Home', filePath: 'index.mdx' },
    ],
    outDir,
    logger: { info: vi.fn() },
    ...overrides,
  }
}

describe('llmsTextPlugin', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('CI', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns a plugin object with name and version', () => {
    const plugin = llmsTextPlugin()
    expect(plugin).toHaveProperty('name', 'boltdocs-plugin-llms-text')
    expect(plugin).toHaveProperty('version', '0.1.0')
  })

  describe('build:generate registration', () => {
    it('is present under the default test environment', () => {
      const plugin = llmsTextPlugin()
      expect(plugin.hooks).toHaveProperty('build:generate')
    })

    it('is present when NODE_ENV is production', () => {
      vi.stubEnv('NODE_ENV', 'production')
      const plugin = llmsTextPlugin()
      expect(plugin.hooks).toHaveProperty('build:generate')
    })

    it('is present when CI is set', () => {
      vi.stubEnv('CI', 'true')
      const plugin = llmsTextPlugin()
      expect(plugin.hooks).toHaveProperty('build:generate')
    })

    it('is present regardless of devMode value', () => {
      const pluginWithDevMode = llmsTextPlugin({ devMode: true })
      expect(pluginWithDevMode.hooks).toHaveProperty('build:generate')

      const pluginWithoutDevMode = llmsTextPlugin({ devMode: false })
      expect(pluginWithoutDevMode.hooks).toHaveProperty('build:generate')
    })
  })

  describe('transformHtml', () => {
    it('injects link tag when siteUrl is present', () => {
      const plugin = llmsTextPlugin()
      const ctx = { config: { siteUrl: 'https://example.com/' } }
      const params = { html: '<html><head></head><body></body></html>' }

      const result = (plugin.hooks!.transformHtml as Function)(ctx, params)
      expect(result.html).toContain(
        '<link rel="llms-txt" href="https://example.com/llms.txt"/>',
      )
    })

    it('returns unchanged html when no siteUrl is configured', () => {
      const plugin = llmsTextPlugin()
      const ctx = { config: {} }
      const params = { html: '<html><head></head><body></body></html>' }

      const result = (plugin.hooks!.transformHtml as Function)(ctx, params)
      expect(result.html).toBe(params.html)
    })

    it('returns unchanged html when addLinkTag is false', () => {
      const plugin = llmsTextPlugin({ addLinkTag: false })
      const ctx = { config: { siteUrl: 'https://example.com/' } }
      const params = { html: '<html><head></head><body></body></html>' }

      const result = (plugin.hooks!.transformHtml as Function)(ctx, params)
      expect(result.html).toBe(params.html)
    })

    it('uses baseUrl option when siteUrl is not configured', () => {
      const plugin = llmsTextPlugin({ baseUrl: 'https://custom.dev' })
      const ctx = { config: {} }
      const params = { html: '<html><head></head><body></body></html>' }

      const result = (plugin.hooks!.transformHtml as Function)(ctx, params)
      expect(result.html).toContain(
        '<link rel="llms-txt" href="https://custom.dev/llms.txt"/>',
      )
    })
  })

  describe('build:generate disk integration', () => {
    it('writes llms.txt with correct structure under non-production NODE_ENV', async () => {
      vi.stubEnv('NODE_ENV', 'test')
      vi.stubEnv('CI', '')

      const plugin = llmsTextPlugin()
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llms-test-'))

      try {
        const ctx = makeTestContext(tmpDir)
        await (plugin.hooks!['build:generate'] as Function)(ctx, {
          routes: ctx.routes,
          outDir: tmpDir,
        })

        const outputPath = path.join(tmpDir, 'llms.txt')
        expect(fs.existsSync(outputPath)).toBe(true)

        const content = fs.readFileSync(outputPath, 'utf-8')
        const lines = content.split('\n')

        expect(lines).toContain('# My Docs')
        expect(lines).toContain('> My description.')
        expect(lines).toContain('## Documentation')
        expect(lines).toContain(
          'Core documentation pages covering installation, usage, API reference, and guides.',
        )
        expect(lines).toContain('- [Guide](https://example.com/docs/guide)')
        expect(lines).toContain('- [Home](https://example.com/)')

        const docHeadingIndex = lines.indexOf('## Documentation')
        expect(lines.indexOf('# My Docs')).toBeLessThan(docHeadingIndex)
        expect(lines.indexOf('> My description.')).toBeLessThan(docHeadingIndex)
        expect(
          lines.indexOf('- [Guide](https://example.com/docs/guide)'),
        ).toBeGreaterThan(docHeadingIndex)
        expect(lines.indexOf('- [Home](https://example.com/)')).toBeGreaterThan(
          docHeadingIndex,
        )

        expect(ctx.logger.info).toHaveBeenCalledWith(
          expect.stringContaining('llms.txt generated'),
        )
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      }
    })

    it('filters locales using the core defaultLocale in build context', async () => {
      const plugin = llmsTextPlugin({ locales: ['es'] })
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llms-test-'))

      try {
        const ctx = makeTestContext(tmpDir, {
          config: {
            siteUrl: 'https://example.com',
            i18n: { defaultLocale: 'en', locales: ['en', 'es'] },
          },
          routes: [
            {
              path: '/docs/guide',
              title: 'English Guide',
              filePath: 'docs/guide.mdx',
            },
            {
              path: '/es/docs/guide',
              title: 'Guía',
              locale: 'es',
              filePath: 'docs/es/guide.mdx',
            },
          ],
        })

        await (plugin.hooks!['build:generate'] as Function)(ctx, {
          routes: ctx.routes,
          outDir: tmpDir,
        })

        const content = fs.readFileSync(path.join(tmpDir, 'llms.txt'), 'utf8')
        expect(content).not.toContain('[English Guide]')
        expect(content).toContain('[Guía]')
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      }
    })

    it('does not write llms.txt when siteUrl is missing', async () => {
      const plugin = llmsTextPlugin()
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llms-test-'))

      try {
        const ctx = makeTestContext(tmpDir, {
          config: {},
          routes: [],
        })

        await (plugin.hooks!['build:generate'] as Function)(ctx, {
          routes: ctx.routes,
          outDir: tmpDir,
        })

        const outputPath = path.join(tmpDir, 'llms.txt')
        expect(fs.existsSync(outputPath)).toBe(false)
        expect(ctx.logger.info).toHaveBeenCalledWith(
          expect.stringContaining('no siteUrl configured'),
        )
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      }
    })

    it('does not write twice when build:generate and afterBuild share the same output', async () => {
      const plugin = llmsTextPlugin()
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llms-test-'))

      try {
        const ctx = makeTestContext(tmpDir)
        const buildGenerate = plugin.hooks!['build:generate'] as Function
        const afterBuild = plugin.hooks!.afterBuild as Function
        await buildGenerate(ctx, { routes: ctx.routes, outDir: tmpDir })
        const writesAfterGenerate = ctx.logger.info.mock.calls.filter((call) =>
          String(call[0]).includes('llms.txt generated'),
        ).length

        await afterBuild(ctx)
        const writesAfterFallback = ctx.logger.info.mock.calls.filter((call) =>
          String(call[0]).includes('llms.txt generated'),
        ).length

        expect(writesAfterGenerate).toBe(1)
        expect(writesAfterFallback).toBe(1)
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      }
    })

    it('deduplicates relative and absolute references to the same output directory', async () => {
      const plugin = llmsTextPlugin()
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llms-test-'))

      try {
        const ctx = makeTestContext(tmpDir)
        const buildGenerate = plugin.hooks!['build:generate'] as Function
        const afterBuild = plugin.hooks!.afterBuild as Function
        await buildGenerate(ctx, { routes: ctx.routes, outDir: tmpDir })
        await afterBuild({
          ...ctx,
          outDir: path.relative(process.cwd(), tmpDir),
        })

        const writes = ctx.logger.info.mock.calls.filter((call) =>
          String(call[0]).includes('llms.txt generated'),
        )
        expect(writes).toHaveLength(1)
        expect(fs.existsSync(path.join(tmpDir, 'llms.txt'))).toBe(true)
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      }
    })

    it('regenerates when the same output directory is reused with changed routes', async () => {
      const plugin = llmsTextPlugin()
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llms-test-'))

      try {
        const ctx = makeTestContext(tmpDir)
        const buildGenerate = plugin.hooks!['build:generate'] as Function
        await buildGenerate(ctx, { routes: ctx.routes, outDir: tmpDir })
        const first = fs.readFileSync(path.join(tmpDir, 'llms.txt'), 'utf8')
        ctx.routes = [{ path: '/new', title: 'New', filePath: 'new.mdx' }]
        await buildGenerate(ctx, { routes: ctx.routes, outDir: tmpDir })
        const second = fs.readFileSync(path.join(tmpDir, 'llms.txt'), 'utf8')

        expect(first).not.toBe(second)
        expect(second).toContain('[New]')
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      }
    })

    it('writes llms.txt when NODE_ENV is production', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const plugin = llmsTextPlugin()
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llms-test-'))

      try {
        const ctx = makeTestContext(tmpDir, {
          config: {
            siteUrl: 'https://prod.example.com',
            theme: { title: 'Prod Docs', description: 'Prod desc.' },
          },
          routes: [{ path: '/', title: 'Home', filePath: 'index.mdx' }],
        })

        await (plugin.hooks!['build:generate'] as Function)(ctx, {
          routes: ctx.routes,
          outDir: tmpDir,
        })

        const outputPath = path.join(tmpDir, 'llms.txt')
        expect(fs.existsSync(outputPath)).toBe(true)
        const content = fs.readFileSync(outputPath, 'utf-8')
        expect(content).toContain('# Prod Docs')
        expect(content).toContain('https://prod.example.com/')
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      }
    })
  })
})
