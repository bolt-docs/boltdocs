import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  createRouteCacheContext,
  disposeRouteCacheContext,
  getRouteCacheContext,
  getRouteCacheVariant,
  getRouteGenerationFingerprint,
  invalidateRouteCache,
} from '../../src/node/routes/cache'
import { generateRoutes } from '../../src/node/routes'

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-route-cache-'))

function createDocs(name: string, title: string): string {
  const docsDir = path.join(tempRoot, name, 'docs')
  fs.mkdirSync(docsDir, { recursive: true })
  fs.writeFileSync(
    path.join(docsDir, 'page.md'),
    `---\ntitle: ${title}\n---\n# ${title}\n`,
  )
  return docsDir
}

describe('route cache isolation', () => {
  afterAll(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true })
  })

  it('keeps concurrent projects and invalidation isolated', async () => {
    const firstDocs = createDocs('first', 'First project')
    const secondDocs = createDocs('second', 'Second project')
    const cacheRoot = path.join(tempRoot, 'shared-cache-root')
    const firstContext = createRouteCacheContext(firstDocs, cacheRoot)
    const secondContext = createRouteCacheContext(secondDocs, cacheRoot)

    const [firstRoutes, secondRoutes] = await Promise.all([
      generateRoutes(firstDocs, undefined, '/docs', false, firstContext),
      generateRoutes(secondDocs, undefined, '/docs', false, secondContext),
    ])

    expect(firstRoutes).toHaveLength(1)
    expect(secondRoutes).toHaveLength(1)
    expect(firstRoutes[0].title).toBe('First project')
    expect(secondRoutes[0].title).toBe('Second project')
    const docsVariant = getRouteCacheVariant(
      firstContext,
      getRouteGenerationFingerprint(undefined, '/docs'),
    )
    const secondDocsVariant = getRouteCacheVariant(
      secondContext,
      getRouteGenerationFingerprint(undefined, '/docs'),
    )
    expect(docsVariant.docCache).not.toBe(secondDocsVariant.docCache)
    expect(docsVariant.parserCache).not.toBe(secondDocsVariant.parserCache)

    fs.writeFileSync(
      path.join(firstDocs, 'page.md'),
      '---\ntitle: First project updated\n---\n# First project updated\n',
    )
    invalidateRouteCache(firstContext)

    const [updatedFirstRoutes, unchangedSecondRoutes] = await Promise.all([
      generateRoutes(firstDocs, undefined, '/docs', false, firstContext),
      generateRoutes(secondDocs, undefined, '/docs', false, secondContext),
    ])

    expect(updatedFirstRoutes[0].title).toBe('First project updated')
    expect(unchangedSecondRoutes[0].title).toBe('Second project')
    expect(secondDocsVariant.docCache.size).toBe(1)
    expect(secondDocsVariant.parserCache.size).toBe(1)

    await getRouteCacheVariant(
      firstContext,
      getRouteGenerationFingerprint(undefined, '/docs'),
    ).docCache.flush()
    await getRouteCacheVariant(
      secondContext,
      getRouteGenerationFingerprint(undefined, '/docs'),
    ).docCache.flush()

    const restoredFirstContext = createRouteCacheContext(firstDocs, cacheRoot)
    const restoredSecondContext = createRouteCacheContext(secondDocs, cacheRoot)
    const [restoredFirstRoutes, restoredSecondRoutes] = await Promise.all([
      generateRoutes(
        firstDocs,
        undefined,
        '/docs',
        false,
        restoredFirstContext,
      ),
      generateRoutes(
        secondDocs,
        undefined,
        '/docs',
        false,
        restoredSecondContext,
      ),
    ])

    expect(restoredFirstRoutes[0].title).toBe('First project updated')
    expect(restoredSecondRoutes[0].title).toBe('Second project')
  })

  it('retries safely when invalidated during generation', async () => {
    const docsDir = path.join(tempRoot, 'mid-generation')
    fs.mkdirSync(docsDir, { recursive: true })
    for (let i = 0; i < 128; i++) {
      fs.writeFileSync(
        path.join(docsDir, `page-${i}.md`),
        `---\ntitle: Original ${i}\n---\n# Original ${i}\n`,
      )
    }

    const context = createRouteCacheContext(
      docsDir,
      path.join(tempRoot, 'mid-generation-cache'),
    )
    const generation = generateRoutes(
      docsDir,
      undefined,
      '/docs',
      false,
      context,
    )
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    fs.writeFileSync(
      path.join(docsDir, 'page-0.md'),
      '---\ntitle: Updated during generation\n---\n# Updated during generation\n',
    )
    invalidateRouteCache(context)

    const routes = await generation
    expect(routes.find((route) => route.path === '/docs/page-0')?.title).toBe(
      'Updated during generation',
    )
    expect(context.activeGenerations.size).toBe(0)
  })

  it('does not retry or recreate a disposed context', async () => {
    const docsDir = path.join(tempRoot, 'disposed-during-generation')
    fs.mkdirSync(docsDir, { recursive: true })
    for (let i = 0; i < 128; i++) {
      fs.writeFileSync(
        path.join(docsDir, `page-${i}.md`),
        `---\ntitle: Page ${i}\n---\n# Page ${i}\n`,
      )
    }

    const context = createRouteCacheContext(
      docsDir,
      path.join(tempRoot, 'disposed-during-generation-cache'),
    )
    const generation = generateRoutes(
      docsDir,
      undefined,
      '/docs',
      false,
      context,
    )
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    disposeRouteCacheContext(docsDir, context)

    await expect(generation).rejects.toThrow(/disposed/i)
    expect(context.disposed).toBe(true)
    expect(context.variants.size).toBe(0)
  })

  it('disposes the registered context when only docsDir is provided', () => {
    const docsDir = path.join(tempRoot, 'implicit-dispose', 'docs')
    const context = getRouteCacheContext(docsDir)
    expect(getRouteCacheContext(docsDir)).toBe(context)

    disposeRouteCacheContext(docsDir)

    expect(getRouteCacheContext(docsDir)).not.toBe(context)
    expect(context.disposed).toBe(true)
  })

  it('caches metadata incrementally and invalidates updates and deletions', async () => {
    const docsDir = path.join(tempRoot, 'metadata-cache', 'docs')
    const groupDir = path.join(docsDir, 'guide')
    fs.mkdirSync(groupDir, { recursive: true })
    fs.writeFileSync(
      path.join(groupDir, 'index.md'),
      '---\ntitle: Guide\n---\n# Guide\n',
    )
    const metaPath = path.join(groupDir, 'meta.json')
    fs.writeFileSync(metaPath, JSON.stringify({ title: 'Guides', order: 2 }))

    const context = createRouteCacheContext(
      docsDir,
      path.join(tempRoot, 'metadata-cache-root'),
    )
    const config = undefined
    await generateRoutes(docsDir, config, '/docs', false, context)
    const variant = getRouteCacheVariant(
      context,
      getRouteGenerationFingerprint(config, '/docs'),
    )
    const firstEntry = variant.directoryMetaEntries.get(metaPath)

    expect(variant.directoryMeta).toEqual({
      guide: { title: 'Guides', order: 2 },
    })
    expect(context.directoryMeta).toBeNull()
    expect(firstEntry).toBeDefined()

    invalidateRouteCache(context)
    await generateRoutes(docsDir, config, '/docs', false, context)
    expect(variant.directoryMetaEntries.get(metaPath)).toBe(firstEntry)

    fs.writeFileSync(
      metaPath,
      JSON.stringify({ title: 'Updated guides', order: 3 }),
    )
    invalidateRouteCache(context)
    await generateRoutes(docsDir, config, '/docs', false, context)

    expect(variant.directoryMeta).toEqual({
      guide: { title: 'Updated guides', order: 3 },
    })
    expect(variant.directoryMetaEntries.get(metaPath)?.content.title).toBe(
      'Updated guides',
    )

    fs.rmSync(metaPath)
    invalidateRouteCache(context)
    await generateRoutes(docsDir, config, '/docs', false, context)

    expect(variant.directoryMeta).toEqual({})
    expect(variant.directoryMetaEntries.has(metaPath)).toBe(false)
    expect(variant.cachedDirectoryMetaFiles).toEqual([])
  })

  it('reuses a persistent discovery snapshot in a fresh context', async () => {
    const docsDir = path.join(tempRoot, 'discovery-snapshot', 'docs')
    fs.mkdirSync(path.join(docsDir, 'guide'), { recursive: true })
    fs.writeFileSync(
      path.join(docsDir, 'guide', 'index.md'),
      '---\ntitle: Guide\n---\n# Guide\n',
    )
    const cacheRoot = path.join(tempRoot, 'discovery-snapshot-cache')
    const firstContext = createRouteCacheContext(docsDir, cacheRoot)
    const firstRoutes = await generateRoutes(
      docsDir,
      undefined,
      '/docs',
      false,
      firstContext,
    )
    const firstVariant = getRouteCacheVariant(
      firstContext,
      getRouteGenerationFingerprint(undefined, '/docs'),
    )

    const secondContext = createRouteCacheContext(docsDir, cacheRoot)
    const secondRoutes = await generateRoutes(
      docsDir,
      undefined,
      '/docs',
      false,
      secondContext,
    )
    const secondVariant = getRouteCacheVariant(
      secondContext,
      getRouteGenerationFingerprint(undefined, '/docs'),
    )

    expect(secondRoutes.map((route) => route.path)).toEqual(
      firstRoutes.map((route) => route.path),
    )
    expect(secondVariant.discoverySnapshot?.files).toEqual(
      firstVariant.discoverySnapshot?.files,
    )
    expect(fs.existsSync(secondVariant.discoverySnapshotPath)).toBe(true)
  })

  it('does not reuse discovery snapshots when cache is disabled', async () => {
    const docsDir = path.join(tempRoot, 'discovery-no-cache', 'docs')
    fs.mkdirSync(docsDir, { recursive: true })
    fs.writeFileSync(
      path.join(docsDir, 'page.md'),
      '---\ntitle: No cache\n---\n# No cache\n',
    )
    const cacheRoot = path.join(tempRoot, 'discovery-no-cache-root')
    const previous = process.env.BOLTDOCS_NO_CACHE
    process.env.BOLTDOCS_NO_CACHE = '1'

    try {
      const context = createRouteCacheContext(docsDir, cacheRoot)
      await generateRoutes(docsDir, undefined, '/docs', false, context)
      const variant = getRouteCacheVariant(
        context,
        getRouteGenerationFingerprint(undefined, '/docs'),
      )

      expect(variant.discoverySnapshot).toBeNull()
      expect(variant.discoverySnapshotLoaded).toBe(false)
      expect(fs.existsSync(variant.discoverySnapshotPath)).toBe(false)
    } finally {
      if (previous === undefined) delete process.env.BOLTDOCS_NO_CACHE
      else process.env.BOLTDOCS_NO_CACHE = previous
    }
  })

  it('rejects discovery snapshots with paths outside docsDir', async () => {
    const docsDir = path.join(tempRoot, 'unsafe-discovery', 'docs')
    fs.mkdirSync(docsDir, { recursive: true })
    const page = path.join(docsDir, 'page.md')
    fs.writeFileSync(page, '---\ntitle: Safe\n---\n# Safe\n')
    const cacheRoot = path.join(tempRoot, 'unsafe-discovery-root')
    const firstContext = createRouteCacheContext(docsDir, cacheRoot)
    await generateRoutes(docsDir, undefined, '/docs', false, firstContext)
    const firstVariant = getRouteCacheVariant(
      firstContext,
      getRouteGenerationFingerprint(undefined, '/docs'),
    )
    const outside = path.join(tempRoot, 'outside.md')
    fs.writeFileSync(outside, '---\ntitle: Outside\n---\n# Outside\n')
    fs.writeFileSync(
      firstVariant.discoverySnapshotPath,
      JSON.stringify({
        version: 1,
        files: [outside],
        directoryMetaFiles: [],
        directories: { [path.resolve(docsDir)]: fs.statSync(docsDir).mtimeMs },
      }),
    )

    const secondContext = createRouteCacheContext(docsDir, cacheRoot)
    const routes = await generateRoutes(
      docsDir,
      undefined,
      '/docs',
      false,
      secondContext,
    )

    expect(routes).toHaveLength(1)
    expect(routes[0]?.title).toBe('Safe')
  })

  it('rejects discovery snapshots that reference external symlinks', async () => {
    const docsDir = path.join(tempRoot, 'symlink-discovery', 'docs')
    fs.mkdirSync(docsDir, { recursive: true })
    const outside = path.join(tempRoot, 'symlink-outside.md')
    fs.writeFileSync(outside, '---\ntitle: Outside\n---\n# Outside\n')
    const link = path.join(docsDir, 'link.md')
    try {
      fs.symlinkSync(outside, link)
    } catch {
      return
    }

    const cacheRoot = path.join(tempRoot, 'symlink-discovery-root')
    const firstContext = createRouteCacheContext(docsDir, cacheRoot)
    await generateRoutes(docsDir, undefined, '/docs', false, firstContext)
    const firstVariant = getRouteCacheVariant(
      firstContext,
      getRouteGenerationFingerprint(undefined, '/docs'),
    )
    fs.writeFileSync(
      firstVariant.discoverySnapshotPath,
      JSON.stringify({
        version: 1,
        files: [link],
        directoryMetaFiles: [],
        directories: { [path.resolve(docsDir)]: fs.statSync(docsDir).mtimeMs },
      }),
    )

    const secondContext = createRouteCacheContext(docsDir, cacheRoot)
    const routes = await generateRoutes(
      docsDir,
      undefined,
      '/docs',
      false,
      secondContext,
    )

    expect(routes.some((route) => route.title === 'Outside')).toBe(false)
  })

  it('recovers from a corrupt discovery snapshot', async () => {
    const docsDir = path.join(tempRoot, 'corrupt-discovery', 'docs')
    fs.mkdirSync(docsDir, { recursive: true })
    fs.writeFileSync(
      path.join(docsDir, 'page.md'),
      '---\ntitle: Corrupt snapshot\n---\n# Corrupt snapshot\n',
    )
    const cacheRoot = path.join(tempRoot, 'corrupt-discovery-root')
    const firstContext = createRouteCacheContext(docsDir, cacheRoot)
    await generateRoutes(docsDir, undefined, '/docs', false, firstContext)
    const firstVariant = getRouteCacheVariant(
      firstContext,
      getRouteGenerationFingerprint(undefined, '/docs'),
    )
    fs.writeFileSync(firstVariant.discoverySnapshotPath, '{not-json')

    const secondContext = createRouteCacheContext(docsDir, cacheRoot)
    const routes = await generateRoutes(
      docsDir,
      undefined,
      '/docs',
      false,
      secondContext,
    )
    const secondVariant = getRouteCacheVariant(
      secondContext,
      getRouteGenerationFingerprint(undefined, '/docs'),
    )

    expect(routes[0]?.title).toBe('Corrupt snapshot')
    expect(secondVariant.discoverySnapshot?.version).toBe(1)
    expect(
      JSON.parse(fs.readFileSync(secondVariant.discoverySnapshotPath, 'utf8'))
        .version,
    ).toBe(1)
  })

  it('refreshes discovery after add and unlink invalidation', async () => {
    const docsDir = path.join(tempRoot, 'discovery-events', 'docs')
    fs.mkdirSync(docsDir, { recursive: true })
    const firstFile = path.join(docsDir, 'first.md')
    const secondFile = path.join(docsDir, 'second.md')
    fs.writeFileSync(firstFile, '---\ntitle: First\n---\n# First\n')
    const context = createRouteCacheContext(
      docsDir,
      path.join(tempRoot, 'discovery-events-root'),
    )

    await generateRoutes(docsDir, undefined, '/docs', false, context)
    fs.writeFileSync(secondFile, '---\ntitle: Second\n---\n# Second\n')
    invalidateRouteCache(context)
    const withSecond = await generateRoutes(
      docsDir,
      undefined,
      '/docs',
      false,
      context,
    )
    expect(withSecond.some((route) => route.title === 'Second')).toBe(true)

    fs.rmSync(secondFile)
    invalidateRouteCache(context)
    const withoutSecond = await generateRoutes(
      docsDir,
      undefined,
      '/docs',
      false,
      context,
    )
    expect(withoutSecond.some((route) => route.title === 'Second')).toBe(false)
  })

  it('does not mix concurrent route configurations', async () => {
    const docsDir = createDocs('config-variants', 'Variant project')
    const context = createRouteCacheContext(
      docsDir,
      path.join(tempRoot, 'variant-cache-root'),
    )

    const [docsRoutes, manualRoutes] = await Promise.all([
      generateRoutes(docsDir, undefined, '/docs', false, context),
      generateRoutes(docsDir, undefined, '/manual', false, context),
    ])

    expect(docsRoutes[0].path).toBe('/docs/page')
    expect(manualRoutes[0].path).toBe('/manual/page')
    expect(context.variants.size).toBeGreaterThanOrEqual(3)
  })
})
