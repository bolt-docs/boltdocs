import { MessageChannel } from 'node:worker_threads'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Piscina from 'piscina'
import { describe, expect, it } from 'vitest'
import { createHtmlTemplate } from '../src/node/html'
import {
  createSsgHydrationScript,
  createSsgRouterContextPayload,
  decodeSsgText,
  encodeSsgText,
} from '../src/node/ssg-worker-payload'

describe('SSG worker router context payload', () => {
  it('round-trips transferred HTML bytes without changing content', () => {
    const html = '<main>Docs — <strong>fast</strong></main>'.repeat(128)
    expect(decodeSsgText(encodeSsgText(html))).toBe(html)
  })

  it('decodes a real Piscina.move worker response', async () => {
    const fixture = join(
      dirname(fileURLToPath(import.meta.url)),
      'fixtures/transfer-worker.mjs',
    )
    const pool = new Piscina({
      filename: fixture,
      minThreads: 1,
      maxThreads: 1,
    })
    try {
      const result = (await pool.run()) as {
        _appHTMLBuffer: ArrayBuffer
      }
      expect(decodeSsgText(result._appHTMLBuffer)).toBe(
        '<main>Transferred SSR HTML — <strong>ok</strong></main>'.repeat(128),
      )
    } finally {
      await pool.destroy()
    }
  })

  it('supports lazy Piscina startup and destruction before first work', async () => {
    const fixture = join(
      dirname(fileURLToPath(import.meta.url)),
      'fixtures/transfer-worker.mjs',
    )
    const pool = new Piscina({
      filename: fixture,
      minThreads: 0,
      maxThreads: 1,
    })

    await expect(pool.destroy()).resolves.toBeUndefined()
  })

  it('starts a lazy Piscina worker on the first render task', async () => {
    const fixture = join(
      dirname(fileURLToPath(import.meta.url)),
      'fixtures/transfer-worker.mjs',
    )
    const pool = new Piscina({
      filename: fixture,
      minThreads: 0,
      maxThreads: 1,
    })
    try {
      const result = (await pool.run()) as {
        _appHTMLBuffer: ArrayBuffer
      }
      expect(decodeSsgText(result._appHTMLBuffer)).toContain(
        '<main>Transferred SSR HTML',
      )
    } finally {
      await pool.destroy()
    }
  })

  it('preserves hydration fields without serializing them', () => {
    const payload = createSsgRouterContextPayload({
      loaderData: { root: { title: 'Docs' } },
      actionData: { saved: true },
      errors: null,
    })

    expect(payload).toEqual({
      loaderData: { root: { title: 'Docs' } },
      actionData: { saved: true },
      errors: null,
    })
    expect(typeof payload).toBe('object')
  })

  it('normalizes missing fields and supports an empty context', () => {
    expect(createSsgRouterContextPayload(undefined)).toBeNull()
    expect(createSsgRouterContextPayload({})).toEqual({
      loaderData: {},
      actionData: null,
      errors: null,
    })
  })

  it('produces identical final HTML for worker and fallback contexts', () => {
    const template = createHtmlTemplate({
      rootContainerId: 'root',
      indexHTML:
        '<!doctype html><html><head></head><body><div id="root"></div></body></html>',
    })
    if (!template) throw new Error('Expected HTML template')
    const renderDocument = (
      routerContext: ReturnType<typeof createSsgRouterContextPayload>,
    ) => {
      const html = template({
        appHTML: '<main>Docs</main>',
        metaAttributes: [],
        bodyAttributes: '',
        htmlAttributes: '',
        initialState: null,
      })
      return html.replace(
        '<head>',
        `<head><script>${createSsgHydrationScript(routerContext)}</script>`,
      )
    }
    const context = {
      loaderData: { root: { title: '<Docs>' } },
      actionData: { saved: true },
      errors: { root: { message: 'failed' } },
    }

    const workerHTML = renderDocument(createSsgRouterContextPayload(context))
    const fallbackHTML = renderDocument(
      createSsgRouterContextPayload({ ...context }),
    )

    expect(workerHTML).toBe(fallbackHTML)
    expect(workerHTML).toContain('window.__staticRouterHydrationData')
  })

  it('produces identical hydration scripts for worker and fallback contexts', () => {
    const context = {
      loaderData: { root: { title: '<Docs>' } },
      actionData: { saved: true },
      errors: { root: { message: 'failed' } },
    }

    const workerPayload = createSsgRouterContextPayload(context)
    const fallbackPayload = createSsgRouterContextPayload({
      loaderData: { root: { title: '<Docs>' } },
      actionData: { saved: true },
      errors: { root: { message: 'failed' } },
    })

    expect(createSsgHydrationScript(workerPayload)).toBe(
      createSsgHydrationScript(fallbackPayload),
    )
    expect(createSsgHydrationScript(workerPayload)).toContain('\\u003cDocs>')
  })

  it('removes values that cannot cross a worker boundary', () => {
    const cyclic: Record<string, unknown> = { keep: true }
    cyclic.self = cyclic
    const payload = createSsgRouterContextPayload({
      loaderData: { cyclic },
      actionData: { callback: () => 'not cloneable' },
      errors: { cyclic },
    })

    expect(payload).toEqual({
      loaderData: { cyclic: { keep: true } },
      actionData: {},
      errors: { cyclic: { keep: true } },
    })
  })

  it('contains only structured-clone-compatible data', async () => {
    const payload = createSsgRouterContextPayload({
      loaderData: { root: ['docs'] },
      actionData: null,
      errors: { root: { message: 'failed' } },
    })
    const { port1, port2 } = new MessageChannel()
    const received = new Promise<unknown>((resolve) => {
      port2.once('message', resolve)
    })
    port1.postMessage(payload)
    expect(await received).toEqual(payload)
    port1.close()
    port2.close()
  })
})
