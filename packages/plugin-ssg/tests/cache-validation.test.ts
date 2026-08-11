import { describe, expect, it } from 'vitest'
import fs from 'fs-extra'
import crypto from 'node:crypto'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  getSsgSourceContentHash,
  isSsgPageCacheValid,
} from '../src/node/cache-validation'

describe('SSG page cache validation', () => {
  it('rejects a stale source hash before SSR import can be skipped', () => {
    const root = join(tmpdir(), `boltdocs-cache-validation-${Date.now()}`)
    const pages = join(root, 'ssg-pages')
    const source = join(root, 'docs', 'intro.md')
    fs.ensureDirSync(pages)
    fs.ensureDirSync(join(root, 'docs'))
    fs.writeFileSync(source, '# Intro')

    const routePath = '/docs/intro'
    const pathHash = crypto.createHash('md5').update(routePath).digest('hex')
    fs.writeFileSync(join(pages, `${pathHash}.html`), '<html />')

    const currentHash = getSsgSourceContentHash(source, 'global-hash')
    expect(
      isSsgPageCacheValid({
        routePath,
        cacheItem: {
          contentHash: 'stale-source-hash',
          assetHash: 'route-assets',
        },
        sourceContentHash: currentHash,
        ssgPagesDir: pages,
        requireAssetHash: true,
      }),
    ).toBe(false)

    fs.removeSync(root)
  })

  it('requires the loader payload when the cache entry references one', () => {
    const root = join(
      tmpdir(),
      `boltdocs-cache-validation-loader-${Date.now()}`,
    )
    const pages = join(root, 'ssg-pages')
    const routePath = '/docs/intro'
    const pathHash = crypto.createHash('md5').update(routePath).digest('hex')
    fs.ensureDirSync(pages)
    fs.writeFileSync(join(pages, `${pathHash}.html`), '<html />')

    expect(
      isSsgPageCacheValid({
        routePath,
        cacheItem: {
          contentHash: 'source-hash',
          assetHash: 'route-assets',
          loaderDataFilePath: 'static-loader-data/docs/intro.hash.json',
        },
        sourceContentHash: 'source-hash',
        ssgPagesDir: pages,
        requireAssetHash: true,
      }),
    ).toBe(false)

    fs.removeSync(root)
  })

  it('accepts a complete cache entry with matching hashes and files', () => {
    const root = join(tmpdir(), `boltdocs-cache-validation-valid-${Date.now()}`)
    const pages = join(root, 'ssg-pages')
    const routePath = '/docs/intro'
    const pathHash = crypto.createHash('md5').update(routePath).digest('hex')
    fs.ensureDirSync(pages)
    fs.writeFileSync(join(pages, `${pathHash}.html`), '<html />')
    fs.writeFileSync(join(pages, `${pathHash}.json`), '{}')

    expect(
      isSsgPageCacheValid({
        routePath,
        cacheItem: {
          contentHash: 'source-hash',
          assetHash: 'route-assets',
          loaderDataFilePath: 'static-loader-data/docs/intro.hash.json',
        },
        sourceContentHash: 'source-hash',
        expectedAssetHash: 'route-assets',
        ssgPagesDir: pages,
        requireAssetHash: true,
      }),
    ).toBe(true)

    fs.removeSync(root)
  })
})
