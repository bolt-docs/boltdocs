import { parentPort } from 'node:worker_threads'
import { parseDocFile } from './parser'

/**
 * Worker thread for parsing MDX files in parallel.
 * This script runs in a separate thread to offload heavy metadata extraction
 * from the main dev server thread.
 */

if (!parentPort) {
  throw new Error('This file must be run as a worker thread.')
}

parentPort.on('message', async (data: { 
  type: 'PARSE_FILE', 
  file: string, 
  docsDir: string, 
  basePath: string, 
  config: any 
}) => {
  if (data.type === 'PARSE_FILE') {
    try {
      const result = parseDocFile(data.file, data.docsDir, data.basePath, data.config)
      parentPort?.postMessage({ type: 'SUCCESS', file: data.file, result })
    } catch (error: any) {
      parentPort?.postMessage({ 
        type: 'ERROR', 
        file: data.file, 
        error: error.message || 'Unknown parsing error' 
      })
    }
  }
})
