import crypto from 'node:crypto'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import fs from 'fs-extra'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computeChunkHashesWithCache } from '../src/node/chunk-hash-cache'

const roots: string[] = []

function makeRoot(): string {
  const root = join(tmpdir(), `boltdocs-chunk-hash-${crypto.randomUUID()}`)
  roots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.remove(root)))
  vi.restoreAllMocks()
})

describe('persistent chunk hash cache', () => {
  it('reuses an unchanged chunk without reading its contents again', async () => {
    const root = makeRoot()
    const output = join(root, 'dist')
    const cacheFile = join(root, 'cache', 'chunk-hashes.json')
    const chunk = 'assets/app.js'
    const chunkPath = join(output, chunk)
    await fs.outputFile(chunkPath, 'client bundle')

    const first = await computeChunkHashesWithCache(output, [chunk], cacheFile)
    const readFile = vi.spyOn(fs, 'readFile')
    const second = await computeChunkHashesWithCache(output, [chunk], cacheFile)

    expect(second).toEqual(first)
    expect(readFile).not.toHaveBeenCalledWith(chunkPath)
  })

  it('invalidates a cached hash when the chunk metadata changes', async () => {
    const root = makeRoot()
    const output = join(root, 'dist')
    const cacheFile = join(root, 'cache', 'chunk-hashes.json')
    const chunk = 'assets/app.js'
    const chunkPath = join(output, chunk)
    await fs.outputFile(chunkPath, 'client bundle')

    const first = await computeChunkHashesWithCache(output, [chunk], cacheFile)
    await fs.writeFile(chunkPath, 'changed client bundle')
    const second = await computeChunkHashesWithCache(output, [chunk], cacheFile)

    expect(second.get(chunk)).toBe(
      crypto.createHash('md5').update('changed client bundle').digest('hex'),
    )
    expect(second.get(chunk)).not.toBe(first.get(chunk))
  })

  it('falls back to fresh reads when the persistent cache is malformed', async () => {
    const root = makeRoot()
    const output = join(root, 'dist')
    const cacheFile = join(root, 'cache', 'chunk-hashes.json')
    const chunk = 'assets/app.js'
    const chunkPath = join(output, chunk)
    await fs.outputFile(chunkPath, 'client bundle')
    await fs.outputFile(cacheFile, '{not-json')

    const hashes = await computeChunkHashesWithCache(output, [chunk], cacheFile)

    expect(hashes.get(chunk)).toBe(
      crypto.createHash('md5').update('client bundle').digest('hex'),
    )
    await expect(fs.readJson(cacheFile)).resolves.toMatchObject({ version: 1 })
  })
})
