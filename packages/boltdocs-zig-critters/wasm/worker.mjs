import { createZigCrittersInstance } from './core.mjs'

/**
 * Per-worker state: one WASM instance per worker thread. CSS strings are
 * cached by reference inside the instance, so a build that always passes the
 * same stylesheet encodes it once per worker.
 */
let instancePromise = null

function getInstance() {
  if (!instancePromise) instancePromise = createZigCrittersInstance()
  return instancePromise
}

const { parentPort } = await import('node:worker_threads')

parentPort.on('message', async (msg) => {
  if (!msg || msg.type !== 'extract') return
  try {
    const instance = await getInstance()
    const result = instance.extractCriticalCssSync(
      msg.html,
      msg.css,
      msg.options,
    )
    parentPort.postMessage({ type: 'result', id: msg.id, result })
  } catch (error) {
    parentPort.postMessage({
      type: 'result',
      id: msg.id,
      result: null,
      error: error instanceof Error ? error.message : String(error),
    })
  }
})
