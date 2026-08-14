import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

let tempDir: string

beforeEach(() => {
  vi.clearAllMocks()
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-e2e-test-'))
})

afterEach(() => {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})

describe('E2E integration tests', () => {
  it('should generate routes with home-page configured', async () => {
    const docsDir = path.join(tempDir, 'docs')
    fs.mkdirSync(docsDir, { recursive: true })

    fs.writeFileSync(
      path.join(docsDir, 'test.md'),
      '---\ntitle: Welcome\n---\n\n# Welcome',
    )

    const { generateRoutes } = await import('../../src/node/routes')
    const config = { theme: { title: 'Test' } }

    const routes = await generateRoutes(docsDir, config as any, '/docs', true)
    expect(routes).toBeDefined()
    expect(Array.isArray(routes)).toBe(true)
    expect(routes.length).toBeGreaterThanOrEqual(1)
  }, 30000)

  it('should handle i18n with home-page', async () => {
    const docsDir = path.join(tempDir, 'docs')
    fs.mkdirSync(docsDir, { recursive: true })

    const enDir = path.join(docsDir, 'en')
    fs.mkdirSync(enDir, { recursive: true })
    fs.writeFileSync(
      path.join(enDir, 'index.mdx'),
      '---\ntitle: Welcome\n---\n\n# Welcome',
    )

    const esDir = path.join(docsDir, 'es')
    fs.mkdirSync(esDir, { recursive: true })
    fs.writeFileSync(
      path.join(esDir, 'index.mdx'),
      '---\ntitle: Bienvenido\n---\n\n# Bienvenido',
    )

    const { generateRoutes } = await import('../../src/node/routes')
    const config = {
      i18n: { defaultLocale: 'en', locales: { en: 'English', es: 'Español' } },
      theme: { title: 'Test' },
    }

    const routes = await generateRoutes(docsDir, config as any, '/docs', true)
    expect(routes.length).toBeGreaterThanOrEqual(2)
  })

  it('should preserve home, blog, changelog, locale, version, sidebar, and headings together', async () => {
    const docsDir = path.join(tempDir, 'docs')
    const files: Record<string, string> = {
      'index.md': '---\ntitle: Home\n---\n# Home\n## Welcome\n',
      'guide.md':
        '---\ntitle: Guide\nsidebarPosition: 1\n---\n# Guide\n## Install\n### Configure\n',
      'es/guide.md':
        '---\ntitle: Guía\nsidebarPosition: 1\n---\n# Guía\n## Instalar\n',
      'v1/guide.md':
        '---\ntitle: Guide v1\nsidebarPosition: 2\n---\n# Guide v1\n## Legacy\n',
      'v1/es/guide.md':
        '---\ntitle: Guía v1\nsidebarPosition: 2\n---\n# Guía v1\n## Legado\n',
      '[blog]/release.md':
        '---\ntitle: Release\ndate: 2026-01-01\n---\n# Release\n## Notes\n',
      '[changelog]/v1.md':
        '---\ntitle: Changelog v1\ndate: 2026-01-02\n---\n# Changelog v1\n',
    }
    for (const [file, content] of Object.entries(files)) {
      const target = path.join(docsDir, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, content)
    }

    const { generateRoutes, invalidateRouteCache } = await import(
      '../../src/node/routes'
    )
    const config = {
      i18n: { defaultLocale: 'en', locales: { en: 'English', es: 'Español' } },
      versions: {
        defaultVersion: 'v1',
        versions: [{ label: 'v1', path: 'v1' }],
      },
      theme: { title: 'Test' },
    }

    const routes = await generateRoutes(docsDir, config as any, '/docs', true)
    const guide = routes.find((route) => route.path === '/docs/guide')
    const spanishGuide = routes.find((route) => route.path === '/docs/es/guide')
    const versionedGuide = routes.find(
      (route) => route.path === '/docs/v1/guide',
    )
    const blog = routes.find((route) => route.collection === 'blog')
    const changelog = routes.find((route) => route.collection === 'changelog')

    expect(guide).toMatchObject({ title: 'Guide', sidebarPosition: 1 })
    expect(guide?.headings?.map((heading) => heading.text)).toEqual([
      'Welcome',
      'Install',
      'Configure',
    ])
    expect(spanishGuide).toMatchObject({ locale: 'es', title: 'Guía' })
    expect(versionedGuide).toMatchObject({ version: 'v1', title: 'Guide v1' })
    expect(blog?.collection).toBe('blog')
    expect(changelog?.collection).toBe('changelog')

    fs.writeFileSync(
      path.join(docsDir, 'guide.md'),
      '---\ntitle: Guide updated\nsidebarPosition: 9\n---\n# Guide updated\n## Changed\n',
    )
    invalidateRouteCache(docsDir)
    const updated = await generateRoutes(docsDir, config as any, '/docs', false)
    const updatedGuide = updated.find((route) => route.path === '/docs/guide')
    expect(updatedGuide).toMatchObject({
      title: 'Guide updated',
      sidebarPosition: 9,
    })
    expect(updatedGuide?.headings?.map((heading) => heading.text)).toEqual([
      'Changed',
    ])
  }, 30000)
})

describe('cache integration with routes', () => {
  it('should use docCache for route generation', async () => {
    const docsDir = path.join(tempDir, 'docs')
    fs.mkdirSync(docsDir, { recursive: true })

    fs.writeFileSync(
      path.join(docsDir, 'test.md'),
      '---\ntitle: Cached Test\n---\n\n# Cached Content',
    )

    const { generateRoutes } = await import('../../src/node/routes')
    const config = { theme: { title: 'Test' } }

    const routes1 = await generateRoutes(docsDir, config as any, '/docs', true)
    expect(routes1.length).toBe(1)

    const routes2 = await generateRoutes(docsDir, config as any, '/docs', false)
    expect(routes2.length).toBe(1)
  })

  it('should invalidate cache on file add', async () => {
    const docsDir = path.join(tempDir, 'docs')
    fs.mkdirSync(docsDir, { recursive: true })

    const { generateRoutes, invalidateRouteCache } = await import(
      '../../src/node/routes'
    )
    const config = { theme: { title: 'Test' } }

    const routes1 = await generateRoutes(docsDir, config as any, '/docs', true)
    expect(routes1.length).toBe(0)

    fs.writeFileSync(
      path.join(docsDir, 'new.md'),
      '---\ntitle: New\n---\n\n# New',
    )

    invalidateRouteCache()
    const routes2 = await generateRoutes(docsDir, config as any, '/docs', true)
    expect(routes2.length).toBe(1)
  })
})

describe('plugin entry code generation with externalPages', () => {
  it('should generate entry code that imports external pages module', async () => {
    const { generateEntryCode } = await import('../../src/node/plugin/entry')

    vi.spyOn(process, 'cwd').mockReturnValue(tempDir)

    const docsDir = path.join(tempDir, 'docs')
    fs.mkdirSync(docsDir, { recursive: true })
    const extDir = path.join(docsDir, 'pages-external')
    fs.mkdirSync(extDir, { recursive: true })
    fs.writeFileSync(path.join(extDir, 'index.tsx'), 'export const pages = {}')

    const options = { docsDir: 'docs' }
    const config = { theme: { title: 'Test' } }

    const code = generateEntryCode(options, config as any, false)
    expect(code).toContain('_external_module')
    expect(code).toContain(
      'export { RouteRenderer, matchRouteBranch, matchRouteBranchWithParams, resolveRouteBranch }',
    )
    expect(code).toContain(
      'createRoot.matchRouteBranchWithParams = matchRouteBranchWithParams;',
    )
  })
})

describe('MDX components integration', () => {
  it('should load custom MDX components path', async () => {
    const docsDir = path.join(tempDir, 'docs')
    fs.mkdirSync(docsDir, { recursive: true })

    fs.writeFileSync(
      path.join(docsDir, 'mdx-components.tsx'),
      'export function Note({ children }) { return <div>{children}</div> }',
    )

    const { boltdocsPlugin } = await import('../../src/node/plugin')
    const plugins = boltdocsPlugin({ docsDir })
    const vmPlugin = plugins.find(
      (p) => p.name === 'vite-plugin-boltdocs-virtual-modules',
    )!

    const code = await vmPlugin.load!('\0virtual:boltdocs-mdx-components')
    expect(code).toContain('mdx-components.tsx')
  }, 30000)
})

describe('layout integration', () => {
  it('should load custom layout', async () => {
    const docsDir = path.join(tempDir, 'docs')
    fs.mkdirSync(docsDir, { recursive: true })

    fs.writeFileSync(
      path.join(docsDir, 'layout.tsx'),
      'export default function Layout({ children }) { return <div>{children}</div> }',
    )

    const { boltdocsPlugin } = await import('../../src/node/plugin')
    const plugins = boltdocsPlugin({ docsDir })
    const vmPlugin = plugins.find(
      (p) => p.name === 'vite-plugin-boltdocs-virtual-modules',
    )!

    const code = await vmPlugin.load!('\0virtual:boltdocs-layout')
    expect(code).toContain('UserLayout')
  })
})

describe('virtual:boltdocs-icons integration', () => {
  it('should load custom icons file if present', async () => {
    const docsDir = path.join(tempDir, 'docs')
    fs.mkdirSync(docsDir, { recursive: true })

    fs.writeFileSync(
      path.join(docsDir, 'icons.tsx'),
      'export const MyCustomIcon = () => <svg></svg>',
    )

    const { boltdocsPlugin } = await import('../../src/node/plugin')
    const plugins = boltdocsPlugin({ docsDir })
    const vmPlugin = plugins.find(
      (p) => p.name === 'vite-plugin-boltdocs-virtual-modules',
    )!

    const code = await vmPlugin.load!('\0virtual:boltdocs-icons')
    expect(code).toContain('icons.tsx')
    expect(code).toContain('export default icons;')
  })

  it('should return empty object if custom icons file is not present', async () => {
    const docsDir = path.join(tempDir, 'docs')
    fs.mkdirSync(docsDir, { recursive: true })

    const { boltdocsPlugin } = await import('../../src/node/plugin')
    const plugins = boltdocsPlugin({ docsDir })
    const vmPlugin = plugins.find(
      (p) => p.name === 'vite-plugin-boltdocs-virtual-modules',
    )!

    const code = await vmPlugin.load!('\0virtual:boltdocs-icons')
    expect(code).toBe('export default {};')
  })
})
