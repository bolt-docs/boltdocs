import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { generateRoutes } from '../../src/node/routes/index'
import * as parser from '../../src/node/routes/parser'
import { docCache } from '../../src/node/routes/cache'
import fs from 'fs'
import path from 'path'
import os from 'os'

// We'll use a real temp directory to avoid fast-glob mocking issues
const tempDocsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'litedocs-tests-'))

// Mock parser and cache
vi.mock('../../src/node/routes/parser')
vi.mock('../../src/node/routes/cache', () => ({
  docCache: {
    load: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    pruneStale: vi.fn(),
    save: vi.fn(),
    invalidateAll: vi.fn(),
  },
}))

describe('generateRoutes', () => {
  const basePath = '/docs'

  beforeEach(() => {
    vi.clearAllMocks()
    ;(docCache.get as any).mockReturnValue(undefined) // ensure cache misses by default
    // Clean temp dir
    const files = fs.readdirSync(tempDocsDir)
    for (const file of files) {
      fs.rmSync(path.join(tempDocsDir, file), { recursive: true, force: true })
    }
  })

  afterAll(() => {
    fs.rmSync(tempDocsDir, { recursive: true, force: true })
  })

  it('should generate routes for found files', async () => {
    fs.writeFileSync(path.join(tempDocsDir, 'a.md'), '# A')
    fs.writeFileSync(path.join(tempDocsDir, 'b.md'), '# B')

    ;(parser.parseDocFile as any).mockImplementation((file: string) => ({
      route: {
        path: '/docs/' + path.basename(file, '.md'),
        title: 'Title',
        sidebarPosition: undefined,
      },
      relativeDir: undefined,
    }))

    const routes = await generateRoutes(tempDocsDir, undefined, basePath)

    expect(routes).toHaveLength(2)
    expect(docCache.save).toHaveBeenCalled()
  })

  it('should handle group directories correctly', async () => {
    const groupDir = path.join(tempDocsDir, 'group')
    if (!fs.existsSync(groupDir)) fs.mkdirSync(groupDir)
    fs.writeFileSync(path.join(groupDir, 'page.md'), '# Page')

    ;(parser.parseDocFile as any).mockReturnValue({
      route: {
        path: '/docs/group/page',
        title: 'Page',
        sidebarPosition: undefined,
      },
      relativeDir: 'group',
      inferredGroupPosition: 1,
    })

    const routes = await generateRoutes(tempDocsDir, undefined, basePath)

    expect(routes).toHaveLength(1)
    expect(routes[0].group).toBe('group')
    expect(routes[0].groupTitle).toBe('Group')
    expect(routes[0].groupPosition).toBe(1)
  })

  it('should sort routes based on sidebarPosition and then alphabetically', async () => {
    fs.writeFileSync(path.join(tempDocsDir, 'z.md'), '# Z')
    fs.writeFileSync(path.join(tempDocsDir, 'a.md'), '# A')
    fs.writeFileSync(path.join(tempDocsDir, 'b.md'), '# B')

    ;(parser.parseDocFile as any).mockImplementation((file: string) => {
      if (file.includes('z.md'))
        return { route: { path: '/docs/z', title: 'Z', sidebarPosition: 1 } }
      if (file.includes('a.md'))
        return { route: { path: '/docs/a', title: 'A', sidebarPosition: 10 } }
      if (file.includes('b.md'))
        return { route: { path: '/docs/b', title: 'B', sidebarPosition: 5 } }
      return {}
    })

    const routes = await generateRoutes(tempDocsDir, undefined, basePath)

    expect(routes[0].path).toBe('/docs/z') // pos 1
    expect(routes[1].path).toBe('/docs/b') // pos 5
    expect(routes[2].path).toBe('/docs/a') // pos 10
  })

  it('should use cache if available and not expired', async () => {
    fs.writeFileSync(path.join(tempDocsDir, 'cached.md'), '# Cached')
    ;(docCache.get as any).mockReturnValue({
      route: { path: '/docs/cached', title: 'Cached' },
    })

    const routes = await generateRoutes(tempDocsDir, undefined, basePath)

    expect(routes).toHaveLength(1)
    expect(routes[0].title).toBe('Cached')
    expect(parser.parseDocFile).not.toHaveBeenCalled()
  })

  it('should handle empty documentation directory', async () => {
    const routes = await generateRoutes(tempDocsDir, undefined, basePath)
    expect(routes).toHaveLength(0)
  })

  it('should invalidate cache if i18n config is present', async () => {
    fs.writeFileSync(path.join(tempDocsDir, 'a.md'), '# A')
    ;(parser.parseDocFile as any).mockReturnValue({
      route: { path: '/docs/a', title: 'A' },
    })

    const config: any = { i18n: { defaultLocale: 'en', locales: { en: {} } } }
    await generateRoutes(tempDocsDir, config, basePath)

    expect(docCache.invalidateAll).toHaveBeenCalled()
  })

  it('should assign group metadata from index files', async () => {
    const uniqueDir = path.join(tempDocsDir, 'test-group-meta')
    const groupDir = path.join(uniqueDir, 'group1')
    if (!fs.existsSync(groupDir)) fs.mkdirSync(groupDir, { recursive: true })
    fs.writeFileSync(path.join(groupDir, 'index.md'), '# Index')
    fs.writeFileSync(path.join(groupDir, 'page.md'), '# Page')

    ;(parser.parseDocFile as any).mockImplementation((file: string) => {
      const normalized = file.replace(/\\/g, '/')
      if (normalized.endsWith('index.md')) {
        return {
          route: { path: '/docs/group1', title: 'Index' },
          relativeDir: 'group1',
          isGroupIndex: true,
          groupMeta: { title: 'Custom Group Title', position: 5 },
        }
      }
      if (normalized.endsWith('page.md')) {
        return {
          route: { path: '/docs/group1/page', title: 'Page' },
          relativeDir: 'group1',
        }
      }
      return { route: { path: '/docs/unknown', title: 'Unknown' } }
    })

    const routes = await generateRoutes(uniqueDir, undefined, basePath)
    const pageRoute = routes.find((r) => r.path === '/docs/group1/page')

    expect(pageRoute?.groupTitle).toBe('Custom Group Title')
    expect(pageRoute?.groupPosition).toBe(5)
  })

  it('should merge inferred position into group entries if index has no position', async () => {
    const uniqueDir = path.join(tempDocsDir, 'test-group-inferred')
    const groupDir = path.join(uniqueDir, '2.group-inferred')
    if (!fs.existsSync(groupDir)) fs.mkdirSync(groupDir, { recursive: true })

    fs.writeFileSync(path.join(groupDir, 'index.md'), '# Index')
    fs.writeFileSync(path.join(groupDir, 'page.md'), '# Page')

    ;(parser.parseDocFile as any).mockImplementation((file: string) => {
      const normalized = file.replace(/\\/g, '/')
      if (normalized.endsWith('index.md')) {
        return {
          route: { path: '/docs/2.group-inferred', title: 'Index' },
          relativeDir: '2.group-inferred',
          isGroupIndex: true,
          groupMeta: { title: 'Group Title Without Position' }, // No position here
        }
      }
      return {
        route: { path: '/docs/2.group-inferred/page', title: 'Page' },
        relativeDir: '2.group-inferred',
        inferredGroupPosition: 2, // Inferrence from directory name
      }
    })

    const routes = await generateRoutes(uniqueDir, undefined, basePath)
    const indexRoute = routes.find((r) => r.path === '/docs/2.group-inferred')

    // The group position should have been merged from the child page's inferred group position (Line 86 hit)
    expect(indexRoute?.groupPosition).toBe(2)
  })

  it('should generate i18n fallback routes for missing translations', async () => {
    const uniqueDir = path.join(tempDocsDir, 'test-i18n-fallback')
    const enDir = path.join(uniqueDir, 'en')
    const esDir = path.join(uniqueDir, 'es')
    if (!fs.existsSync(enDir)) fs.mkdirSync(enDir, { recursive: true })
    if (!fs.existsSync(esDir)) fs.mkdirSync(esDir, { recursive: true })

    fs.writeFileSync(path.join(enDir, 'page.md'), '# English')
    fs.writeFileSync(path.join(enDir, 'only-en.md'), '# Only English')
    fs.writeFileSync(path.join(esDir, 'page.md'), '# Spanish')

    ;(parser.parseDocFile as any).mockImplementation((file: string) => {
      const normalized = file.replace(/\\/g, '/')
      if (normalized.includes('only-en.md')) {
        return {
          route: { path: '/docs/only-en', title: 'Only EN', locale: 'en' },
        }
      }
      if (normalized.includes('es/page.md')) {
        return {
          route: { path: '/docs/es/page', title: 'ES Page', locale: 'es' },
        }
      }
      return { route: { path: '/docs/page', title: 'EN Page', locale: 'en' } } // default en page
    })

    const config: any = {
      i18n: {
        defaultLocale: 'en',
        locales: { en: { label: 'English' }, es: { label: 'Spanish' } },
      },
    }

    const routes = await generateRoutes(uniqueDir, config, basePath)

    // Routes include explicit routes + generated fallbacks
    expect(routes.length).toBeGreaterThanOrEqual(3)

    const esFallback = routes.find((r) => r.path === '/docs/es/only-en')
    expect(esFallback).toBeDefined()
    expect(esFallback?.locale).toBe('es')
    expect(esFallback?.title).toBe('Only EN') // Copied from EN
  })

  it('should correctly handle base paths and versions when generating fallbacks', async () => {
    const uniqueDir = path.join(tempDocsDir, 'test-versions-fallback')
    const v1EnDir = path.join(uniqueDir, 'v1/en')
    if (!fs.existsSync(v1EnDir)) fs.mkdirSync(v1EnDir, { recursive: true })

    fs.writeFileSync(path.join(v1EnDir, 'page.md'), '# English v1')

    ;(parser.parseDocFile as any).mockImplementation((file: string) => {
      return {
        route: {
          path: '/docs/v1/page',
          title: 'EN Page v1',
          locale: 'en',
          version: 'v1',
        },
      }
    })

    const config: any = {
      i18n: {
        defaultLocale: 'en',
        locales: { en: { label: 'English' }, fr: { label: 'French' } },
      },
    }

    const routes = await generateRoutes(uniqueDir, config, '/docs')

    // Should generate routes based on the files present
    expect(routes.length).toBeGreaterThanOrEqual(1)

    // Verify v1 route exists
    const v1Route = routes.find((r) => r.path.includes('/v1/'))
    expect(v1Route).toBeDefined()
  })

  it('should handle stripping base locale exactly or as prefix in paths', async () => {
    const uniqueDir = path.join(tempDocsDir, 'test-i18n-locale-strip')
    const enDir = path.join(uniqueDir, 'en')
    if (!fs.existsSync(enDir)) fs.mkdirSync(enDir, { recursive: true })

    // Creates exactly `/en`
    fs.writeFileSync(path.join(enDir, 'index.md'), '# English Root')
    // Creates `/en/prefix` -> begins with `/en/`
    fs.writeFileSync(path.join(enDir, 'prefix.md'), '# English Prefix')

    ;(parser.parseDocFile as any).mockImplementation((file: string) => {
      const normalized = file.replace(/\\/g, '/')
      if (normalized.endsWith('index.md')) {
        return {
          route: { path: '/docs/en', title: 'EN Root', locale: 'en' },
        }
      }
      return {
        route: { path: '/docs/en/prefix', title: 'EN Prefix', locale: 'en' },
      }
    })

    const config: any = {
      i18n: {
        defaultLocale: 'en',
        locales: { en: { label: 'English' }, pt: { label: 'Portuguese' } },
      },
    }

    const routes = await generateRoutes(uniqueDir, config, '/docs')

    expect(routes.find((r) => r.path === '/docs/pt')).toBeDefined() // Stripped exact /en
    expect(routes.find((r) => r.path === '/docs/pt/prefix')).toBeDefined() // Stripped prefix /en/
  })
})
