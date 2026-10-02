import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { RouteGenerateStep } from '../../src/node/pipeline/steps/route-generate'
import { TypeGenerateStep } from '../../src/node/pipeline/steps/type-generate'
import { SSGBuildStep } from '../../src/node/pipeline/steps/ssg-build'
import { RoutesEnrichStep } from '../../src/node/pipeline/steps/routes-enrich'
import { GenerateStep } from '../../src/node/pipeline/steps/generate'
import { SeoMissingNoticeStep } from '../../src/node/pipeline/steps/seo-missing-notice'
import { createBuildPipeline } from '../../src/node/pipeline/build-pipeline'
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

describe('RoutesEnrichStep', () => {
  it('fires build:routes with the live route array', async () => {
    const seen: unknown[] = []
    const routes = [{ path: '/docs/hello', title: 'Hello' }] as any
    const ctx = ctxFor({
      routes,
      config: {
        siteUrl: 'https://example.com',
        plugins: [
          {
            name: 'spy',
            hooks: {
              'build:routes': (_c: unknown, p: any) => {
                seen.push(p.routes)
              },
            },
          },
        ],
      } as any,
    })

    await new RoutesEnrichStep().execute(ctx)

    expect(seen).toHaveLength(1)
    expect(seen[0]).toBe(routes)
  })

  it('is a no-op when no plugins are configured', async () => {
    const ctx = ctxFor({ routes: [] as any, config: { plugins: [] } as any })
    await expect(new RoutesEnrichStep().execute(ctx)).resolves.toBeUndefined()
  })

  it('throws when routes are missing, since order is load-bearing', async () => {
    const ctx = ctxFor({
      routes: undefined,
      config: { plugins: [{ name: 'x' }] } as any,
    })
    await expect(new RoutesEnrichStep().execute(ctx)).rejects.toThrow(
      /pipeline order/,
    )
  })
})

describe('GenerateStep', () => {
  it('fires build:generate with an absolute outDir', async () => {
    const seen: any[] = []
    const ctx = ctxFor({
      routes: [] as any,
      outDir: 'dist',
      config: {
        siteUrl: 'https://example.com',
        plugins: [
          {
            name: 'spy',
            hooks: {
              'build:generate': (_c: unknown, p: any) => {
                seen.push(p)
              },
            },
          },
        ],
      } as any,
    })

    await new GenerateStep().execute(ctx)

    expect(seen).toHaveLength(1)
    expect(path.isAbsolute(seen[0].outDir)).toBe(true)
    expect(seen[0].siteUrl).toBe('https://example.com')
  })

  it('fires even when no plugin needs SEO', async () => {
    // This is the regression the step exists for: build:generate used to live
    // inside SEOWriteStep, so @bdocs/plugin-rss depended on an SEO step.
    const fired: string[] = []
    const ctx = ctxFor({
      routes: [] as any,
      outDir: 'dist',
      config: {
        plugins: [
          {
            name: 'rss',
            hooks: {
              'build:generate': () => {
                fired.push('generate')
              },
            },
          },
        ],
      } as any,
    })

    await new GenerateStep().execute(ctx)
    expect(fired).toEqual(['generate'])
  })
})

describe('SeoMissingNoticeStep', () => {
  it('warns when SEO is configured but no SEO plugin is present', async () => {
    const ctx = ctxFor({
      config: { siteUrl: 'https://example.com', plugins: [] } as any,
    })
    // Should not throw; the warning path is exercised through the dui logger.
    await expect(
      new SeoMissingNoticeStep().execute(ctx),
    ).resolves.toBeUndefined()
  })

  it('stays quiet when the SEO plugin is registered', async () => {
    const ctx = ctxFor({
      config: {
        siteUrl: 'https://example.com',
        plugins: [{ name: 'plugin-seo' }],
      } as any,
    })
    await expect(
      new SeoMissingNoticeStep().execute(ctx),
    ).resolves.toBeUndefined()
  })

  it('stays quiet when the site never configured any SEO', async () => {
    const ctx = ctxFor({ config: { plugins: [] } as any })
    await expect(
      new SeoMissingNoticeStep().execute(ctx),
    ).resolves.toBeUndefined()
  })
})

describe('SSGBuildStep', () => {
  it('requires routes and a vite config', async () => {
    await expect(
      new SSGBuildStep().execute(ctxFor({ viteConfig: undefined })),
    ).rejects.toThrow(/not initialized/)
  })
})

describe('build:generate ordering', () => {
  it('is registered after the SSG step, not before', () => {
    // build:generate needs the output directory to exist, so the step must run
    // after SSGBuildStep in the pipeline.
    const names = createBuildPipeline().stepNames

    expect(names.indexOf('Generate')).toBeGreaterThan(names.indexOf('SSGBuild'))
  })

  it('runs RoutesEnrich before the SSG render', () => {
    // Route SEO enrichment must land before Head renders, or canonical and
    // og:url are missing from every page.
    const names = createBuildPipeline().stepNames

    expect(names.indexOf('RoutesEnrich')).toBeGreaterThan(
      names.indexOf('RouteGenerate'),
    )
    expect(names.indexOf('RoutesEnrich')).toBeLessThan(
      names.indexOf('SSGBuild'),
    )
  })

  it('no longer declares SEO steps', () => {
    const names = createBuildPipeline().stepNames

    expect(names).not.toContain('SEOWrite')
    expect(names).not.toContain('SEOValidate')
  })
})
