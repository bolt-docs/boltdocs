import { afterEach, describe, expect, it } from 'vitest'
import fs from 'fs-extra'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  hardLinkDir,
  listClientBundleFiles,
  resolveSsrCacheDirectory,
  syncPublicAssets,
  shouldSuppressBundleLog,
} from '../src/node/pipeline/bundles'

const temporaryDirectories: string[] = []

function createTemporaryDirectory(name: string): string {
  const directory = join(
    tmpdir(),
    `boltdocs-bundles-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  )
  fs.ensureDirSync(directory)
  temporaryDirectories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => fs.remove(directory)),
  )
})

describe('SSG bundle pipeline helpers', () => {
  it('preserves the log suppression policy outside build.ts', () => {
    expect(shouldSuppressBundleLog('dist/assets/app.js')).toBe(true)
    expect(shouldSuppressBundleLog('rendering chunks')).toBe(true)
    expect(shouldSuppressBundleLog('useful warning')).toBe(false)
  })

  it('accepts only an in-root SSR cache directory with a bundle', () => {
    const root = createTemporaryDirectory('ssr-root')
    const bundle = join(root, 'hash', 'combined.mjs')
    fs.ensureDirSync(join(root, 'hash'))
    fs.writeFileSync(bundle, 'export {}')

    expect(resolveSsrCacheDirectory(root, 'hash')).toBe(join(root, 'hash'))
    expect(resolveSsrCacheDirectory(root, '../outside')).toBeUndefined()
  })

  it('materializes a client bundle through hard links', () => {
    const source = createTemporaryDirectory('source')
    const destination = createTemporaryDirectory('destination')
    const sourceFile = join(source, 'assets', 'app.js')
    const destinationFile = join(destination, 'assets', 'app.js')

    fs.ensureDirSync(join(source, 'assets'))
    fs.writeFileSync(sourceFile, 'bundle')
    hardLinkDir(source, destination)

    expect(fs.readFileSync(destinationFile, 'utf8')).toBe('bundle')
    expect(fs.statSync(destinationFile).ino).toBe(fs.statSync(sourceFile).ino)
  })

  it('accepts an initial client hash without recomputing it on cache restore', async () => {
    const { executeClientBundle } = await import('../src/node/pipeline/bundles')
    const root = createTemporaryDirectory('initial-hash-root')
    const cache = createTemporaryDirectory('initial-hash-cache')
    fs.ensureDirSync(join(cache, 'dist'))
    fs.writeFileSync(join(cache, 'dist', 'index.html'), 'shell')
    const computeClientHash = () => {
      throw new Error('initial hash should avoid recomputation')
    }

    await expect(
      executeClientBundle(
        {
          viteConfig: {},
          resolvedMode: 'production',
          root,
          htmlEntry: 'index.html',
          outDir: join(root, 'dist'),
          clientCacheDir: cache,
          finalCacheDir: root,
          docsDirName: 'docs',
          initialClientHash: 'initial-hash',
          canBypassClientBuild: true,
          customLogger: undefined,
          shouldSuppressLog: () => false,
        },
        computeClientHash,
      ),
    ).resolves.toMatchObject({ resolvedClientHash: 'initial-hash' })
  })

  it('copies public assets and prunes deleted nested assets', async () => {
    const publicDir = createTemporaryDirectory('public')
    const output = createTemporaryDirectory('public-output')
    fs.ensureDirSync(join(publicDir, 'icons'))
    fs.writeFileSync(join(publicDir, 'dark.svg'), '<svg />')
    fs.writeFileSync(join(publicDir, 'icons', 'old.svg'), '<svg old />')

    await syncPublicAssets(publicDir, output)
    expect(fs.readFileSync(join(output, 'dark.svg'), 'utf8')).toBe('<svg />')
    expect(fs.readFileSync(join(output, 'icons', 'old.svg'), 'utf8')).toBe(
      '<svg old />',
    )

    await fs.remove(join(publicDir, 'icons', 'old.svg'))
    await syncPublicAssets(publicDir, output)

    expect(fs.existsSync(join(output, 'icons', 'old.svg'))).toBe(false)
    expect(fs.existsSync(join(output, 'dark.svg'))).toBe(true)
  })

  it('clears tracked public assets when publicDir is disabled', async () => {
    const publicDir = createTemporaryDirectory('public-disabled')
    const output = createTemporaryDirectory('public-disabled-output')
    fs.writeFileSync(join(publicDir, 'asset.txt'), 'asset')

    await syncPublicAssets(publicDir, output)
    await syncPublicAssets(false, output)

    expect(fs.existsSync(join(output, 'asset.txt'))).toBe(false)
  })

  it('does not delete a generated replacement for a removed public asset', async () => {
    const publicDir = createTemporaryDirectory('public-ownership')
    const output = createTemporaryDirectory('public-ownership-output')
    const asset = join(publicDir, 'shared.js')
    const generated = join(output, 'shared.js')
    fs.writeFileSync(asset, 'public version')

    await syncPublicAssets(publicDir, output)
    await fs.remove(asset)
    fs.writeFileSync(generated, 'generated replacement')
    await syncPublicAssets(publicDir, output)

    expect(fs.readFileSync(generated, 'utf8')).toBe('generated replacement')
  })

  it('keeps cache inventories free of the client html entry', () => {
    const source = createTemporaryDirectory('inventory-source')
    fs.ensureDirSync(join(source, 'assets'))
    fs.writeFileSync(join(source, 'index.html'), 'shell')
    fs.writeFileSync(join(source, 'assets', 'app.js'), 'bundle')
    fs.writeFileSync(join(source, 'assets', 'app.css'), 'styles')

    expect(listClientBundleFiles(source, 'index.html')).toEqual([
      'assets/app.css',
      'assets/app.js',
    ])
  })
})
