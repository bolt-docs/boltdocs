import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'path'
import fs from 'fs'
import os from 'os'

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
