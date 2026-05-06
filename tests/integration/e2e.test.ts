import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'path'
import fs from 'fs'
import os from 'os'

describe('E2E integration tests', () => {
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

  it('should generate routes with home-page configured', async () => {
    const docsDir = path.join(tempDir, 'docs')
    fs.mkdirSync(docsDir, { recursive: true })

    fs.writeFileSync(path.join(docsDir, 'test.md'), '---\ntitle: Welcome\n---\n\n# Welcome')

    const { generateRoutes } = await import('../../packages/core/src/node/routes')
    const config = { homePage: './src/home-page.tsx', theme: { title: 'Test' } }

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
    fs.writeFileSync(path.join(enDir, 'index.mdx'), '---\ntitle: Welcome\n---\n\n# Welcome')

    const esDir = path.join(docsDir, 'es')
    fs.mkdirSync(esDir, { recursive: true })
    fs.writeFileSync(path.join(esDir, 'index.mdx'), '---\ntitle: Bienvenido\n---\n\n# Bienvenido')

    const { generateRoutes } = await import('../../packages/core/src/node/routes')
    const config = {
      homePage: './src/home-page.tsx',
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

    fs.writeFileSync(path.join(docsDir, 'test.md'), '---\ntitle: Cached Test\n---\n\n# Cached Content')

    const { generateRoutes } = await import('../../packages/core/src/node/routes')
    const config = { theme: { title: 'Test' } }

    const routes1 = await generateRoutes(docsDir, config as any, '/docs', true)
    expect(routes1.length).toBe(1)

    const routes2 = await generateRoutes(docsDir, config as any, '/docs', false)
    expect(routes2.length).toBe(1)
  })

  it('should invalidate cache on file add', async () => {
    const docsDir = path.join(tempDir, 'docs')
    fs.mkdirSync(docsDir, { recursive: true })

    const { generateRoutes, invalidateRouteCache } = await import('../../packages/core/src/node/routes')
    const config = { theme: { title: 'Test' } }

    const routes1 = await generateRoutes(docsDir, config as any, '/docs', true)
    expect(routes1.length).toBe(0)

    fs.writeFileSync(path.join(docsDir, 'new.md'), '---\ntitle: New\n---\n\n# New')

    invalidateRouteCache()
    const routes2 = await generateRoutes(docsDir, config as any, '/docs', true)
    expect(routes2.length).toBe(1)
  })
})

describe('plugin entry code generation with homePage', () => {
  it('should generate entry code that imports homePage', async () => {
    const { generateEntryCode } = await import('../../packages/core/src/node/plugin/entry')

    const options = { homePage: './src/home-page.tsx' }
    const config = { theme: { title: 'Test' } }

    const code = generateEntryCode(options, config as any, tempDir)
    expect(code).toContain('HomePage')
  })
})

describe('MDX components integration', () => {
  it('should load custom MDX components path', async () => {
    const docsDir = path.join(tempDir, 'docs')
    fs.mkdirSync(docsDir, { recursive: true })

    fs.writeFileSync(path.join(docsDir, 'mdx-components.tsx'), 'export function Note({ children }) { return <div>{children}</div> }')

    const { boltdocsPlugin } = await import('../../packages/core/src/node/plugin')
    const plugins = boltdocsPlugin({ docsDir })
    const vmPlugin = plugins.find((p) => p.name === 'vite-plugin-boltdocs-virtual-modules')!

    const code = await vmPlugin.load!('\0virtual:boltdocs-mdx-components')
    expect(code).toContain('mdx-components.tsx')
  }, 30000)
})

describe('layout integration', () => {
  it('should load custom layout', async () => {
    const docsDir = path.join(tempDir, 'docs')
    fs.mkdirSync(docsDir, { recursive: true })

    fs.writeFileSync(path.join(docsDir, 'layout.tsx'), 'export default function Layout({ children }) { return <div>{children}</div> }')

    const { boltdocsPlugin } = await import('../../packages/core/src/node/plugin')
    const plugins = boltdocsPlugin({ docsDir })
    const vmPlugin = plugins.find((p) => p.name === 'vite-plugin-boltdocs-virtual-modules')!

    const code = await vmPlugin.load!('\0virtual:boltdocs-layout')
    expect(code).toContain('UserLayout')
  })
})
})
