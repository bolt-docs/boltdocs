import { spawn, type ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline'
import type { MermaidThemeVariables } from '../shared/types'

// ── Worker path ───────────────────────────────────────────────
const workerPath = fileURLToPath(
  new URL('./render-worker.mjs', import.meta.url),
)

const pluginDir = fileURLToPath(new URL('../../', import.meta.url))

// ── Persistent worker pool ────────────────────────────────────
// We spawn ONE worker process that stays alive across all
// sequential diagram renders. The worker reads JSON requests
// from stdin and writes JSON responses to stdout.

let workerProcess: ChildProcess | null = null
let workerReader: ReturnType<typeof createInterface> | null = null
let workerPendingResolve: ((result: WorkerOutput) => void) | null = null
let workerPendingReject: ((err: Error) => void) | null = null

interface WorkerInput {
  chart: string
  lightTheme: MermaidThemeVariables
  darkTheme: MermaidThemeVariables
}

interface WorkerOutput {
  svgLight?: string
  svgDark?: string
  error?: string
}

function startWorker(): void {
  if (workerProcess) return

  workerProcess = spawn(process.execPath, [workerPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: process.env,
    cwd: pluginDir,
  })

  workerReader = createInterface({ input: workerProcess.stdout! })

  workerReader.on('line', (line: string) => {
    if (!line.trim()) return
    const resolve = workerPendingResolve
    workerPendingResolve = null
    workerPendingReject = null
    if (resolve) {
      try {
        const output: WorkerOutput = JSON.parse(line)
        resolve(output)
      } catch {
        resolve({
          error: `Failed to parse worker output: ${line.substring(0, 200)}`,
        })
      }
    }
  })

  workerProcess.on('error', (err) => {
    const reject = workerPendingReject
    workerPendingResolve = null
    workerPendingReject = null
    workerProcess = null
    workerReader = null
    if (reject) reject(new Error(`Worker error: ${err.message}`))
  })

  workerProcess.on('exit', (code) => {
    workerProcess = null
    workerReader = null
    const reject = workerPendingReject
    workerPendingResolve = null
    workerPendingReject = null
    if (reject) {
      reject(new Error(`Worker exited unexpectedly with code ${code}`))
    }
  })
}

function stopWorker(): void {
  if (workerProcess) {
    workerProcess.stdin?.end()
    workerProcess.kill()
    workerProcess = null
    workerReader = null
  }
  workerPendingResolve = null
  workerPendingReject = null
}

async function sendRequest(input: WorkerInput): Promise<WorkerOutput> {
  if (!workerProcess || !workerProcess.stdin) {
    throw new Error('Worker not started')
  }

  return new Promise<WorkerOutput>((resolve, reject) => {
    workerPendingResolve = resolve
    workerPendingReject = reject
    workerProcess!.stdin!.write(JSON.stringify(input) + '\n')
  })
}

// ── Sequential queue ──────────────────────────────────────────
let lastRender: Promise<void> = Promise.resolve()

async function sequential<T>(fn: () => Promise<T>): Promise<T> {
  const prev = lastRender
  let release: () => void
  const wait = new Promise<void>((r) => {
    release = r
  })
  lastRender = wait
  await prev.catch(() => {})
  try {
    return await fn()
  } finally {
    release!()
  }
}

// ── Public API ────────────────────────────────────────────────

/**
 * Render a mermaid diagram for both light & dark themes by sending
 * the request to a persistent child process worker.
 *
 * The worker runs in a plain Node.js context (no Vite SSR wrapping),
 * so mermaid's bundled createDOMPurify has proper access to the DOM
 * environment (jsdom + DOMPurify + SVG getBBox patches).
 *
 * Returns `{ svgLight, svgDark }` on success, or `{ error }` on failure
 * (caller should fall back to client-side rendering).
 */
/**
 * Stop the persistent worker. Call this after all renders are done
 * to clean up the child process.
 */
export function stopRenderer(): void {
  stopWorker()
}

export async function renderMermaidBothThemes(
  chart: string,
  lightTheme: MermaidThemeVariables,
  darkTheme: MermaidThemeVariables,
): Promise<{ svgLight?: string; svgDark?: string; error?: string }> {
  return sequential(async () => {
    try {
      startWorker()
      const result = await sendRequest({ chart, lightTheme, darkTheme })
      return result
    } catch (e) {
      // Worker failed — stop it so the next call creates a fresh one
      stopWorker()
      return { error: String(e) }
    }
  })
}
