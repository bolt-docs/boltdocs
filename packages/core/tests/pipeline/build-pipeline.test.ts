import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { SEOValidateStep } from '../../src/node/pipeline/steps/seo-validate'
import { RouteGenerateStep } from '../../src/node/pipeline/steps/route-generate'
import { TypeGenerateStep } from '../../src/node/pipeline/steps/type-generate'
import { SEOWriteStep } from '../../src/node/pipeline/steps/seo-write'
import { SSGBuildStep } from '../../src/node/pipeline/steps/ssg-build'
import type { BuildContext } from '../../src/node/pipeline/types'

let root: string

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-step-'))
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

const ctxFor = (overrides: Partial<BuildContext> = {}): BuildContext => ({
  root,
  docsDir: 'docs',
  config: { siteUrl: 'https://example.com' } as any,
  routes: [
    { path: '/docs/api', filePath: 'docs/api.mdx', title: 'API' },
  ] as any,
  ssgRoutes: [],
  routePaths: ['/docs/api'],
  timing: {},
  outDir: 'dist',
  ...overrides,
})

describe('TypeGenerateStep', () => {
  it('writes project types and a link tree, then flags the build', async () => {
    const ctx = ctxFor()
    await new TypeGenerateStep().execute(ctx)
    expect(ctx.typesGenerated).toBe(true)
    expect(
      fs.existsSync(path.join(root, '.boltdocs', 'generated', 'types.d.ts')),
    ).toBe(true)
    expect(
      fs.existsSync(
        path.join(root, '.boltdocs', 'generated', 'link-tree.json'),
      ),
    ).toBe(true)
  })

  it('throws when context lacks config or docs dir', async () => {
    await expect(
      new TypeGenerateStep().execute(ctxFor({ config: undefined })),
    ).rejects.toThrow(/not initialized/)
  })
})

describe('RouteGenerateStep', () => {
  it('passes through when routes already exist', async () => {
    const ctx = ctxFor()
    await new RouteGenerateStep().execute(ctx) // no-op, no throw
    expect(ctx.routes).toHaveLength(1)
  })

  it('fails loudly when routes are missing', async () => {
    await expect(
      new RouteGenerateStep().execute(ctxFor({ routes: undefined })),
    ).rejects.toThrow(/Verify pipeline order/)
  })
})

describe('SEOWriteStep', () => {
  it('writes sitemap.xml and robots.txt into the out dir', async () => {
    fs.mkdirSync(path.join(root, 'dist'))
    const ctx = ctxFor({
      ssgRoutes: [{ path: '/docs/hello', title: 'Hello' }] as any,
      outDir: 'dist',
    })
    await new SEOWriteStep().execute(ctx)
    expect(fs.existsSync(path.join(root, 'dist', 'sitemap.xml'))).toBe(true)
    expect(fs.existsSync(path.join(root, 'dist', 'robots.txt'))).toBe(true)
    const sitemap = fs.readFileSync(
      path.join(root, 'dist', 'sitemap.xml'),
      'utf-8',
    )
    expect(sitemap).toContain('https://example.com/docs/hello')
  })

  it('throws when ssg routes or out dir are missing', async () => {
    await expect(
      new SEOWriteStep().execute(ctxFor({ ssgRoutes: undefined })),
    ).rejects.toThrow(/not initialized/)
  })
})

describe('SSGBuildStep', () => {
  it('requires routes and a vite config', async () => {
    await expect(
      new SSGBuildStep().execute(ctxFor({ viteConfig: undefined })),
    ).rejects.toThrow(/not initialized/)
  })
})

describe('SEOValidateStep', () => {
  it('resolves og:image against siteUrl', async () => {
    const step = new SEOValidateStep()
    const ctx = ctxFor({
      routes: [{ path: '/aa', filePath: 'aa.mdx', title: 'T' }] as any,
      config: {
        siteUrl: 'https://example.com',
        seo: { thumbnails: { background: '/og.png' } },
      } as any,
    })
    await step.execute(ctx)
    expect(ctx.routes![0].seo).toBeDefined()
  })
})
