import { describe, it, expect, vi, beforeEach } from 'vitest'

const { fakeAdapter } = vi.hoisted(() => {
  const runtime = {
    codeToHast: vi.fn().mockReturnValue({ type: 'root', children: [] }),
    codeToHtml: vi.fn().mockResolvedValue('<pre></pre>'),
  }
  return {
    fakeAdapter: {
      name: 'shiki',
      getOptions: vi.fn(() => ({ lang: 'javascript' })),
      initialize: vi.fn().mockResolvedValue(runtime),
      ensureLanguage: vi.fn().mockResolvedValue(true),
      prewarm: vi.fn(),
    },
  }
})

// The built-in shiki factory lazily imports this module — stub it so the
// registry tests never pay the ~2.5s highlighter build.
vi.mock('../../src/node/mdx/shiki-adapter', () => ({
  getShikiAdapter: () => fakeAdapter,
}))

import {
  DEFAULT_HIGHLIGHTER,
  registerHighlighter,
  registerPluginHighlighter,
  getCodeHighlighterAdapter,
  isHighlighterRegistered,
  getHighlighterNames,
  prewarmHighlighter,
} from '../../src/node/highlight/registry'

describe('highlight registry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('defaults to the built-in shiki engine', () => {
    expect(DEFAULT_HIGHLIGHTER).toBe('shiki')
    expect(isHighlighterRegistered(DEFAULT_HIGHLIGHTER)).toBe(true)
    expect(getHighlighterNames()).toContain('shiki')
  })

  it('resolves the shiki engine by default when no engine is specified', async () => {
    const adapter = await getCodeHighlighterAdapter()
    expect(adapter).toBe(fakeAdapter)
    expect(fakeAdapter.getOptions).not.toHaveBeenCalled()
  })

  it('resolves an adapter instance passed as engine', async () => {
    const custom = {
      name: 'prism',
      getOptions: vi.fn(() => ({})),
      initialize: vi.fn().mockResolvedValue({
        codeToHast: vi.fn(),
        codeToHtml: vi.fn().mockResolvedValue('<pre></pre>'),
      }),
    }
    const adapter = await getCodeHighlighterAdapter({
      engine: custom as never,
    })
    expect(adapter).toBe(custom)
  })

  it('resolves an adapter factory passed as engine', async () => {
    const built = {
      name: 'factory-engine',
      getOptions: vi.fn(() => ({})),
      initialize: vi.fn().mockResolvedValue({
        codeToHast: vi.fn(),
        codeToHtml: vi.fn().mockResolvedValue('<pre></pre>'),
      }),
    }
    const factory = vi.fn().mockResolvedValue(built)
    const adapter = await getCodeHighlighterAdapter({
      engine: factory as never,
    })
    expect(factory).toHaveBeenCalledTimes(1)
    expect(adapter).toBe(built)
  })

  it('resolves a registered custom engine by id', async () => {
    const custom = {
      name: 'my-engine',
      getOptions: vi.fn(() => ({})),
      initialize: vi.fn().mockResolvedValue({
        codeToHast: vi.fn(),
        codeToHtml: vi.fn().mockResolvedValue('<pre></pre>'),
      }),
    }
    const factory = vi.fn().mockResolvedValue(custom)
    registerHighlighter('my-engine', factory as never)

    const adapter = await getCodeHighlighterAdapter({ engine: 'my-engine' })
    expect(adapter).toBe(custom)
    expect(factory).toHaveBeenCalledWith({
      engine: 'my-engine',
      theme: undefined,
      options: undefined,
    })
    expect(isHighlighterRegistered('my-engine')).toBe(true)
  })

  it('registers plugin engines under the plugin name, first one wins', async () => {
    const a = {
      name: 'plugin-a',
      getOptions: vi.fn(() => ({})),
      initialize: vi.fn().mockResolvedValue({
        codeToHast: vi.fn(),
        codeToHtml: vi.fn().mockResolvedValue('<pre></pre>'),
      }),
    }
    const b = {
      name: 'plugin-b',
      getOptions: vi.fn(() => ({})),
      initialize: vi.fn().mockResolvedValue({
        codeToHast: vi.fn(),
        codeToHtml: vi.fn().mockResolvedValue('<pre></pre>'),
      }),
    }
    registerPluginHighlighter('dupe-plugin', a as never)
    registerPluginHighlighter('dupe-plugin', b as never)

    const adapter = await getCodeHighlighterAdapter({ engine: 'dupe-plugin' })
    expect(adapter).toBe(a)
  })

  it('falls back to the default engine on a broken adapter shape', async () => {
    const adapter = await getCodeHighlighterAdapter({
      engine: { name: 'nope' } as never,
    })
    expect(adapter).toBe(fakeAdapter)
  })

  it('prewarm resolves and pings the adapter off the critical path', async () => {
    vi.spyOn(fakeAdapter, 'prewarm').mockImplementation(() => {})
    prewarmHighlighter()
    // Fire-and-forget; give the microtask queue a chance to resolve.
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(fakeAdapter.prewarm).toHaveBeenCalled()
  })
})
