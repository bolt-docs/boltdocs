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
 * P2-10: Cache the adapter after warm-up so per-page renders skip the
 * expensive createRoot(false, path) call.  Use ArrayBuffer transferList
 * for large HTML strings to avoid structured clone overhead.
 */

import { workerData } from 'node:worker_threads'
import { getAdapter } from './router-adapter'

interface SsgWorkerData {
  ssrEntryPath: string
  format: 'esm' | 'cjs'
}

let _sharedAdapter: ReturnType<typeof getAdapter> | null = null

export default async function renderTask(msg: { type: string; path: string }) {
  if (msg.type !== 'render' || !msg.path) {
    throw new Error('Invalid render job payload')
  }

  if (!_sharedAdapter) {
    const { ssrEntryPath, format } = workerData as SsgWorkerData
    const mod: {
      createRoot: (client: boolean, routePath?: string) => Promise<any>
    } =
      format === 'esm'
        ? await import(ssrEntryPath)
        : (await import('node:module')).createRequire(import.meta.url)(
            ssrEntryPath,
          )

    const ctx = await mod.createRoot(false)
    _sharedAdapter = getAdapter(ctx)
  }

  const {
    appHTML,
    bodyAttributes,
    htmlAttributes,
    metaAttributes,
    styleTag,
    routerContext,
  } = await _sharedAdapter.render(msg.path)

  const ctxLoaderData =
    routerContext &&
    typeof routerContext === 'object' &&
    'loaderData' in routerContext
      ? ((routerContext as { loaderData?: Record<string, unknown> })
          .loaderData ?? {})
      : {}

  const loaderData =
    ctxLoaderData && Object.keys(ctxLoaderData).length > 0
      ? ctxLoaderData
      : null

  const routerContextJSON = routerContext
    ? JSON.stringify({
        loaderData:
          (routerContext as { loaderData?: Record<string, unknown> })
            .loaderData ?? {},
        actionData:
          (routerContext as { actionData?: unknown }).actionData ?? null,
        errors: (routerContext as { errors?: unknown }).errors ?? null,
      })
    : null

  const appHTMLEncoded = new TextEncoder().encode(appHTML)
  const resultPayload: Record<string, unknown> = {
    path: msg.path,
    _appHTMLBuffer: appHTMLEncoded.buffer,
    metaAttributes,
    bodyAttributes,
    htmlAttributes,
    styleTag,
    loaderData,
  }

  if (routerContextJSON) {
    const ctxEncoded = new TextEncoder().encode(routerContextJSON)
    resultPayload._routerContextBuffer = ctxEncoded.buffer
  }

  return resultPayload
}
