import { describe, expect, it, vi } from 'vitest'
import { createDeferredFileWriteQueue } from '../src/node/deferred-file-write'

describe('deferred SSG file writes', () => {
  it('flushes a batch concurrently and reports no pending writes', async () => {
    const writes: string[] = []
    const queue = createDeferredFileWriteQueue({
      batchSize: 2,
      writeFile: vi.fn(async (filePath, content) => {
        writes.push(`${filePath}:${content}`)
      }),
    })

    await queue.enqueue('a.html', 'A')
    expect(queue.pendingCount()).toBe(1)
    await queue.enqueue('b.html', 'B')

    expect(queue.pendingCount()).toBe(0)
    expect(writes).toEqual(['a.html:A', 'b.html:B'])
    await queue.flush()
    expect(queue.pendingCount()).toBe(0)
  })

  it('flushes when the byte budget is reached', async () => {
    const writeFile = vi.fn(async () => {})
    const queue = createDeferredFileWriteQueue({
      batchSize: 100,
      maxBytes: 3,
      writeFile,
    })

    await queue.enqueue('a.html', 'abcd')

    expect(writeFile).toHaveBeenCalledTimes(1)
    expect(queue.pendingCount()).toBe(0)
  })

  it('preserves batch order when another batch is queued during a flush', async () => {
    const writes: string[] = []
    let releaseFirst: (() => void) | undefined
    const firstStarted = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const writeFile = vi.fn(async (filePath: string) => {
      if (filePath === 'a.html') await firstStarted
      writes.push(filePath)
    })
    const queue = createDeferredFileWriteQueue({
      batchSize: 1,
      writeFile,
    })

    const firstFlush = queue.enqueue('a.html', 'A')
    const secondFlush = queue.enqueue('b.html', 'B')
    releaseFirst?.()

    await Promise.all([firstFlush, secondFlush])
    expect(writes).toEqual(['a.html', 'b.html'])
  })

  it('writes an individual oversized page without retaining it in the buffer', async () => {
    const writeFile = vi.fn(async () => {})
    const queue = createDeferredFileWriteQueue({
      batchSize: 100,
      maxBytes: 3,
      writeFile,
    })

    await queue.enqueue('large.html', '123456')

    expect(writeFile).toHaveBeenCalledTimes(1)
    expect(queue.pendingCount()).toBe(0)
  })

  it('propagates a write failure from flush', async () => {
    const queue = createDeferredFileWriteQueue({
      batchSize: 1,
      writeFile: vi.fn(async () => {
        throw new Error('disk full')
      }),
    })

    await expect(queue.enqueue('broken.html', 'x')).rejects.toThrow('disk full')
  })
})
