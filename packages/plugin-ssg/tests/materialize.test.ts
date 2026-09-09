import crypto from 'node:crypto'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import fs from 'fs-extra'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { linkOrCopyFile, materializeFiles } from '../src/node/materialize'

const makeRoot = () =>
  join(tmpdir(), `boltdocs-materialize-${crypto.randomUUID()}`)

const cleanupRoots: string[] = []

afterEach(async () => {
  await Promise.all(cleanupRoots.splice(0).map((root) => fs.remove(root)))
  vi.restoreAllMocks()
})

describe('SSG output materialization', () => {
  it('replaces an existing hardlink without mutating its source inode', async () => {
    const root = makeRoot()
    cleanupRoots.push(root)
    const cacheSource = join(root, 'cache.html')
    const previousSource = join(root, 'previous-cache.html')
    const destination = join(root, 'dist', 'index.html')

    await fs.ensureDir(root)
    await fs.ensureDir(join(root, 'dist'))
    await fs.writeFile(cacheSource, 'new page')
    await fs.writeFile(previousSource, 'old page')
    await fs.link(previousSource, destination)

    await linkOrCopyFile(cacheSource, destination)

    await expect(fs.readFile(destination, 'utf8')).resolves.toBe('new page')
    await expect(fs.readFile(previousSource, 'utf8')).resolves.toBe('old page')
  })

  it('falls back to copying when hardlinks are unavailable', async () => {
    const root = makeRoot()
    cleanupRoots.push(root)
    const source = join(root, 'cache.html')
    const destination = join(root, 'dist', 'index.html')
    await fs.ensureDir(root)
    await fs.writeFile(source, 'copied page')

    const link = vi
      .spyOn(fs, 'link')
      .mockRejectedValueOnce(
        Object.assign(new Error('cross-device link'), { code: 'EXDEV' }),
      )

    await linkOrCopyFile(source, destination)

    expect(link).toHaveBeenCalledWith(source, destination)
    await expect(fs.readFile(destination, 'utf8')).resolves.toBe('copied page')
  })

  it('materializes duplicate destinations once and keeps the first source', async () => {
    const root = makeRoot()
    cleanupRoots.push(root)
    const firstSource = join(root, 'first.html')
    const secondSource = join(root, 'second.html')
    const destination = join(root, 'dist', 'index.html')
    await fs.ensureDir(root)
    await fs.writeFile(firstSource, 'first page')
    await fs.writeFile(secondSource, 'second page')

    await materializeFiles([
      { source: firstSource, destination },
      { source: secondSource, destination },
    ])

    await expect(fs.readFile(destination, 'utf8')).resolves.toBe('first page')
  })

  it('batches HTML and loader destinations without overwriting either entry', async () => {
    const root = makeRoot()
    cleanupRoots.push(root)
    const htmlSource = join(root, 'cache.html')
    const loaderSource = join(root, 'cache.json')
    const htmlDestination = join(root, 'dist', 'docs', 'index.html')
    const loaderDestination = join(
      root,
      'dist',
      'static-loader-data',
      'docs.json',
    )

    await fs.ensureDir(root)
    await fs.writeFile(htmlSource, '<html>cached</html>')
    await fs.writeFile(loaderSource, '{"loader":"cached"}')

    await materializeFiles([
      { source: htmlSource, destination: htmlDestination },
      { source: loaderSource, destination: loaderDestination },
    ])

    await expect(fs.readFile(htmlDestination, 'utf8')).resolves.toBe(
      '<html>cached</html>',
    )
    await expect(fs.readFile(loaderDestination, 'utf8')).resolves.toBe(
      '{"loader":"cached"}',
    )
  })
})
