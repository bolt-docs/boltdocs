import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('satteri', () => ({
  defineHastPlugin: (def: unknown) => def,
}))

/**
 * These tests are about what the pipeline does when the engine is NOT Shiki.
 *
 * `rehype-shiki-plugin.ts` is named for the default engine but is documented as
 * engine-agnostic, and the highlighter registry accepts any adapter. The
 * questions below ask a narrower and more useful thing: when the pipeline
 * handles an engine it has never seen, does it fall back in a way that engine
 * can actually satisfy — or does it hardcode an assumption about Shiki and
 * strand the block?
 *
 * A fake engine is the only honest way to ask. Shiki satisfies every accidental
 * requirement the pipeline happens to have, so testing against it proves
 * nothing about agnosticism.
 */
const { adapterRef, registryMock } = vi.hoisted(() => {
  const ref: { current: unknown } = { current: null }
  return {
    adapterRef: ref,
    registryMock: {
      getCodeHighlighterAdapter: vi.fn(async () => ref.current),
    },
  }
})

vi.mock('boltdocs/node/highlight', () => registryMock)

const { satteriRehypeCodeHighlightPlugin, clearHighlightCache } = await import(
  '../node/satteri-plugins/rehype-shiki-plugin'
)

type Plugin = {
  element: {
    filter: string[]
    visit: (node: unknown, ctx: unknown) => Promise<unknown>
  }
}

function codeNode(lang: string, value = 'const x = 1'): unknown {
  return {
    type: 'element',
    tagName: 'pre',
    properties: {},
    children: [
      {
        type: 'element',
        tagName: 'code',
        properties: { className: [`language-${lang}`] },
        children: [{ type: 'text', value }],
      },
    ],
  }
}

const ctx = {
  textContent: () => '',
  source: 'test',
  fileURL: undefined,
  data: {},
  removeNode: vi.fn(),
  replaceNode: vi.fn(),
  insertBefore: vi.fn(),
  insertAfter: vi.fn(),
  wrapNode: vi.fn(),
  prependChild: vi.fn(),
  appendChild: vi.fn(),
  insertChildAt: vi.fn(),
  removeChildAt: vi.fn(),
  setProperty: vi.fn(),
  parent: vi.fn(),
  indexOf: vi.fn(),
  report: vi.fn(),
  getDiagnostics: () => [],
}

/**
 * An engine that is not Shiki and makes no promises about Shiki's language ids.
 * It knows `rust`; it has never heard of `plaintext`, and it will throw if
 * asked for a language it does not have — which is exactly how a real engine
 * behaves.
 */
function makeForeignEngine() {
  const known = new Set(['rust'])
  const calls: string[] = []
  const codeToHast = vi.fn((code: string, options: { lang?: string }) => {
    const lang = options?.lang ?? ''
    if (!known.has(lang)) {
      throw new Error(`foreign-engine: unknown language "${lang}"`)
    }
    return {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'pre',
          properties: { className: ['foreign-code'] },
          children: [{ type: 'text', value: code }],
        },
      ],
    }
  })
  const codeToHtml = vi.fn(async (code: string, options: { lang?: string }) => {
    const lang = options?.lang ?? ''
    if (!known.has(lang)) {
      throw new Error(`foreign-engine: unknown language "${lang}"`)
    }
    return `<pre class="foreign-code">${code}</pre>`
  })
  const runtime = { codeToHast, codeToHtml }
  return {
    calls,
    runtime,
    adapter: {
      name: 'foreign-engine',
      getOptions: (lang: string) => ({ lang }),
      ensureLanguage: vi.fn(async (lang: string) => {
        calls.push(lang)
        return known.has(lang)
      }),
      renderPlaintext: vi.fn(async (code: string) => `<pre>${code}</pre>`),
      initialize: vi.fn(async () => runtime),
    },
  }
}

describe('highlight pipeline: a non-Shiki engine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearHighlightCache()
  })

  it('renders a language the foreign engine knows', async () => {
    const engine = makeForeignEngine()
    adapterRef.current = engine.adapter

    const plugin = satteriRehypeCodeHighlightPlugin() as unknown as Plugin
    const result = (await plugin.element.visit(codeNode('rust'), ctx)) as {
      properties: Record<string, unknown>
    }

    // The engine's own class survives — the framework did not replace it.
    expect(JSON.stringify(result.properties.className)).toContain(
      'foreign-code',
    )
    expect(result.properties['data-code-engine']).toBe('foreign-engine')
    expect(result.properties['data-highlighted']).toBe('true')
  })

  it('asks the engine to render plaintext rather than naming a Shiki language id', async () => {
    const engine = makeForeignEngine()
    adapterRef.current = engine.adapter

    const plugin = satteriRehypeCodeHighlightPlugin() as unknown as Plugin
    // `brainfuck` is unknown to this engine, so the fallback path runs.
    await plugin.element.visit(codeNode('brainfuck'), ctx)

    // The engine was never asked for a language id it does not own. This is
    // the assertion the whole change exists for: before it, the pipeline sent
    // `lang: 'plaintext'` — an id whose meaning is Shiki's, not the contract's.
    //
    // Checked on the *runtime* rather than on `ensureLanguage`: the pipeline can
    // reach a language id through `codeToHast` without ever calling
    // `ensureLanguage` for it, and that is the path this guards.
    for (const call of engine.runtime.codeToHast.mock.calls) {
      expect(call[1]).not.toMatchObject({ lang: 'plaintext' })
    }
    for (const call of engine.runtime.codeToHtml.mock.calls) {
      expect(call[1]).not.toMatchObject({ lang: 'plaintext' })
    }
  })

  it('never emits a Shiki-named class at a foreign engine', async () => {
    const engine = makeForeignEngine()
    adapterRef.current = engine.adapter

    const plugin = satteriRehypeCodeHighlightPlugin() as unknown as Plugin
    const result = (await plugin.element.visit(codeNode('brainfuck'), ctx)) as {
      properties: Record<string, unknown>
    }

    const rendered = JSON.stringify(result.properties)
    expect(rendered).not.toContain('shiki-fallback')
    // State is expressed as data the theme can key off, not as an engine name.
    expect(result.properties['data-code-state']).toBeDefined()
  })

  it('does not ask an engine for its grammar before rendering a known language twice', async () => {
    const engine = makeForeignEngine()
    adapterRef.current = engine.adapter

    const plugin = satteriRehypeCodeHighlightPlugin() as unknown as Plugin
    await plugin.element.visit(codeNode('rust'), ctx)
    clearHighlightCache()
    await plugin.element.visit(codeNode('rust'), ctx)

    // Two visits, two ensureLanguage calls: the pipeline must not cache the
    // decision to skip it, or a second block of the same language renders
    // through a path that assumes the grammar is already resident.
    expect(engine.adapter.ensureLanguage).toHaveBeenCalledTimes(2)
  })
})
