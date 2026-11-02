/**
 * SSG Worker — runs in a Node.js worker_thread.
 *
 * Each worker loads the SSR entry once, then processes render jobs sent
 * by the main thread.  Multiple workers (one per CPU core) run in parallel
 * so CPU-bound React.renderToString calls are distributed across cores.
 *
 * IMPORTANT: imports from this package must be STATIC (not dynamic) so
 * tsdown bundles them into the worker file.  A dynamic import like
 * `await import('./router-adapter')` would try to resolve a separate
 * file at runtime that doesn't exist.
 *
 * Cache the adapter after warm-up so per-page renders skip the
 * expensive createRoot(false, path) call. Results use a plain structured-clone
 * payload so the worker protocol stays compatible across ESM and CJS builds.
 */

import Piscina from 'piscina'

import { createRequire } from 'node:module'
import { workerData } from 'node:worker_threads'
import { getAdapter } from './router-adapter'
import type { RouterEntryModule } from '../router-contract'
import type { ViteReactSSGContext } from '../types'
import {
  createSsgRouterContextPayload,
  encodeSsgText,
} from './ssg-worker-payload'

interface SsgWorkerData {
  ssrEntryPath: string
  format: 'esm' | 'cjs'
}

type WorkerEntryModule = RouterEntryModule & {
  createRoot: (
    client: boolean,
    routePath?: string,
  ) => Promise<ViteReactSSGContext<true> | ViteReactSSGContext<false>>
}

let _sharedAdapter: ReturnType<typeof getAdapter> | null = null

async function renderOne(path: string, transfer = true) {
  if (!path) throw new Error('Invalid render job payload')

  if (!_sharedAdapter) {
    const { ssrEntryPath, format } = workerData as SsgWorkerData
    const mod: WorkerEntryModule =
      format === 'esm'
        ? ((await import(ssrEntryPath)) as WorkerEntryModule)
        : (createRequire(import.meta.url)(ssrEntryPath) as WorkerEntryModule)

    const ctx = (await mod.createRoot(false)) as ViteReactSSGContext
    _sharedAdapter = getAdapter(ctx, mod)
  }

  const {
    appHTML,
    bodyAttributes,
    htmlAttributes,
    metaAttributes,
    styleTag,
    routerContext,
    timings,
  } = await _sharedAdapter.render(path)

  const routerContextPayload = createSsgRouterContextPayload(routerContext)

  // Keep the router context structured across the worker boundary. The main
  // thread serializes it once when generating the hydration script instead of
  // paying JSON stringify + parse + stringify for every page.
  // HTML is the largest value crossing the worker boundary. Transfer its
  // UTF-8 backing buffer instead of structured-cloning a large JavaScript
  // string; the main thread decodes it without changing the rendered output.
  const appHTMLBuffer = encodeSsgText(appHTML)
  const resultPayload: Record<string, unknown> = {
    path,
    _appHTMLBuffer: appHTMLBuffer,
    metaAttributes,
    bodyAttributes,
    htmlAttributes,
    styleTag,
    routerContext: routerContextPayload,
    timings,
  }

  // Piscina only discovers nested transferables through its custom
  // transferable/value symbols. Mark the whole result as movable so the
  // ArrayBuffer property is transferred instead of cloned or detached.
  const transferableResult = {
    get [Piscina.transferableSymbol]() {
      return [appHTMLBuffer]
    },
    get [Piscina.valueSymbol]() {
      return resultPayload
    },
  }

  // The cast is at a library boundary: Piscina's own type for `move` is
  // derived from `MessagePort.postMessage`'s transfer list, which is
  // `Transferable[]` — and a transferable list *item* carrying Piscina's own
  // symbols is exactly what the function documents, but the type cannot
  // describe it. The runtime reads the two getters, which is what the library
  // does with them.
  return transfer
    ? Piscina.move(
        transferableResult as unknown as Parameters<typeof Piscina.move>[0],
      )
    : resultPayload
}

export default async function renderTask(msg: {
  type: string
  path?: string
  paths?: string[]
}) {
  if (msg.type === 'render') {
    return renderOne(msg.path || '')
  }
  if (msg.type === 'render-batch' && Array.isArray(msg.paths)) {
    const results: Record<string, unknown>[] = []
    const transferables: ArrayBuffer[] = []
    for (const path of msg.paths) {
      try {
        const result = (await renderOne(path, false)) as Record<string, unknown>
        results.push(result)
        const buffer = result._appHTMLBuffer
        if (buffer instanceof ArrayBuffer) {
          transferables.push(buffer)
        } else if (buffer && ArrayBuffer.isView(buffer)) {
          const transferable = buffer.buffer
          if (transferable instanceof ArrayBuffer) {
            transferables.push(transferable)
          }
        }
      } catch (error) {
        results.push({
          path,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
    // See the note on the single-render path above: the library's type for
    // `move` cannot describe a transferable list item.
    return Piscina.move({
      get [Piscina.transferableSymbol]() {
        return transferables
      },
      get [Piscina.valueSymbol]() {
        return results
      },
    } as unknown as Parameters<typeof Piscina.move>[0])
  }
  throw new Error('Invalid render job payload')
}
