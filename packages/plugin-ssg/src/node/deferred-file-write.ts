export interface DeferredFileWrite {
  filePath: string
  content: string
}

export interface DeferredFileWriteQueueOptions {
  batchSize?: number
  maxBytes?: number
  writeFile: (filePath: string, content: string) => Promise<void>
}

export interface DeferredFileWriteQueue {
  enqueue(filePath: string, content: string): Promise<void>
  flush(): Promise<void>
  pendingCount(): number
  writeTimeMs(): number
}

const DEFAULT_BATCH_SIZE = 64
const DEFAULT_MAX_BYTES = 8 * 1024 * 1024

/**
 * Buffer small page writes and flush them in bounded concurrent batches.
 *
 * The queue deliberately exposes an explicit flush: callers must await it
 * before publishing cache/output state. A chained flush keeps batches ordered
 * while still allowing the writes inside each batch to run concurrently.
 */
export function createDeferredFileWriteQueue({
  batchSize = DEFAULT_BATCH_SIZE,
  maxBytes = DEFAULT_MAX_BYTES,
  writeFile,
}: DeferredFileWriteQueueOptions): DeferredFileWriteQueue {
  const safeBatchSize = Math.max(1, Math.floor(batchSize))
  const safeMaxBytes = Math.max(1, Math.floor(maxBytes))
  let pending: DeferredFileWrite[] = []
  let pendingBytes = 0
  let flushChain = Promise.resolve()
  let totalWriteTimeMs = 0

  const flush = (): Promise<void> => {
    if (pending.length === 0) return flushChain

    const batch = pending
    pending = []
    pendingBytes = 0

    flushChain = flushChain.then(async () => {
      const start = performance.now()
      await Promise.all(
        batch.map(({ filePath, content }) => writeFile(filePath, content)),
      )
      totalWriteTimeMs += performance.now() - start
    })

    return flushChain
  }

  return {
    enqueue(filePath, content) {
      const contentBytes = Buffer.byteLength(content, 'utf8')

      // Never retain an individual page larger than the memory budget. Drain
      // the earlier batch first, then write this item through the same ordered
      // chain without buffering its contents in `pending`.
      if (contentBytes > safeMaxBytes) {
        const previous = flush()
        flushChain = previous.then(async () => {
          const start = performance.now()
          await writeFile(filePath, content)
          totalWriteTimeMs += performance.now() - start
        })
        return flushChain
      }

      pending.push({ filePath, content })
      pendingBytes += contentBytes

      if (pending.length >= safeBatchSize || pendingBytes >= safeMaxBytes) {
        return flush()
      }
      return Promise.resolve()
    },
    flush,
    pendingCount() {
      return pending.length
    },
    writeTimeMs() {
      return totalWriteTimeMs
    },
  }
}
