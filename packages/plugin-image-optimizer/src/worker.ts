import { parentPort } from 'node:worker_threads'

if (!parentPort) {
  throw new Error('worker.ts must be run as a worker thread')
}

parentPort.on(
  'message',
  async (msg: {
    type: string
    filePath: string
    buffer: Uint8Array
    formatOptions: Record<string, unknown>
    svgOptions: Record<string, unknown>
  }) => {
    if (msg.type !== 'OPTIMIZE_IMAGE') return

    try {
      const source = Buffer.from(msg.buffer)
      let result: Buffer

      if (/\.svg$/.test(msg.filePath)) {
        const { optimize } = await import('svgo')
        result = Buffer.from(
          optimize(source.toString(), {
            path: msg.filePath,
            ...msg.svgOptions,
          }).data,
        )
      } else {
        const sharp = (await import('sharp')).default
        const ext = msg.filePath.split('.').pop()?.toLowerCase() || ''
        result = await sharp(source, { animated: ext === 'gif' })
          .toFormat(ext as any, msg.formatOptions)
          .toBuffer()
      }

      parentPort.postMessage({
        type: 'SUCCESS',
        filePath: msg.filePath,
        buffer: result,
      })
    } catch (error: any) {
      parentPort.postMessage({
        type: 'ERROR',
        filePath: msg.filePath,
        error: error.message || 'Unknown optimization error',
      })
    }
  },
)
