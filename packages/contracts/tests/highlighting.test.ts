import { describe, expect, it } from 'vitest'
import type {
  CodeHighlightConfig,
  CodeHighlighterAdapter,
  CodeHighlighterRuntime,
  CodeTheme,
} from '../src'

/**
 * Characterization of the highlighting contract.
 *
 * The adapter SPI is the seam that lets a site swap Shiki for another engine.
 * These tests pin the *shape* rather than any engine's behaviour, because the
 * shape is what a third-party engine compiles against: if `renderPlaintext`
 * changes from optional to required, or `CodeTheme` narrows, an engine written
 * against this version breaks at a point far from this file.
 *
 * The two bugs these exist for were both invisible from inside Shiki:
 *
 * 1. The pipeline degraded a failed grammar by sending `lang: 'plaintext'` to
 *    whatever engine was registered. Shiki has that grammar, so it always
 *    worked; an engine without it threw from inside the fallback — the code
 *    written to rescue a broken block failed the same way the block did.
 * 2. The fallback class was `shiki-fallback`, naming the default engine in the
 *    markup, while the theme keyed 28 rules off `.shiki`.
 */

/** The smallest adapter a third party can write. */
function minimalAdapter(): CodeHighlighterAdapter {
  return {
    name: 'minimal',
    getOptions: (lang) => ({ lang }),
    initialize: async (): Promise<CodeHighlighterRuntime> => ({
      codeToHast: (code) => ({ type: 'root', children: [{ value: code }] }),
      codeToHtml: async (code) => code,
    }),
  }
}

describe('CodeHighlighterAdapter', () => {
  it('is satisfiable without renderPlaintext', () => {
    // Optional on purpose: requiring it would make every adapter implement a
    // method the framework can do without, and the framework's own fallback —
    // an escaped <pre> — is already correct.
    const adapter = minimalAdapter()

    expect(adapter.renderPlaintext).toBeUndefined()
    expect(typeof adapter.ensureLanguage).toBe('undefined')
    expect(typeof adapter.prewarm).toBe('undefined')
  })

  it('carries renderPlaintext as a framework-agnostic escape hatch', () => {
    const adapter: CodeHighlighterAdapter = {
      ...minimalAdapter(),
      // An engine whose plaintext output is its own concern — the framework
      // never sends a language id to ask for it.
      renderPlaintext: async (code) => `<pre>${code}</pre>`,
    }

    expect(typeof adapter.renderPlaintext).toBe('function')
  })

  it('requires only name, getOptions and initialize', () => {
    // The minimum viable surface an engine author must implement.
    const adapter = minimalAdapter()

    expect(typeof adapter.name).toBe('string')
    expect(typeof adapter.getOptions).toBe('function')
    expect(typeof adapter.initialize).toBe('function')
  })
})

describe('CodeTheme', () => {
  it('accepts the named-theme and light/dark pair every engine can express', () => {
    const named: CodeTheme = 'github-dark'
    const pair: CodeTheme = { light: 'github-light', dark: 'github-dark' }

    expect(named).toBe('github-dark')
    expect(pair.dark).toBe('github-dark')
  })

  it('accepts an engine-defined theme shape without a contract change', () => {
    // An engine with semantic tokens cannot be expressed by a string or a
    // light/dark pair. Narrowing this union to enumerate engines would mean a
    // new engine is a breaking change to the framework, which is backwards:
    // the adapter is better placed to interpret its own theme than a type is
    // to predict every engine that will exist.
    const tokens: CodeTheme = { tokens: { keyword: '#c792ea' } }
    const engineSpecific: CodeTheme = { syntaxTheme: 'night-owl', contrast: 2 }

    expect(tokens).toHaveProperty('tokens')
    expect(engineSpecific).toHaveProperty('syntaxTheme')
  })
})

describe('CodeHighlightConfig', () => {
  it('accepts an engine as a string, an adapter, or a factory', () => {
    const byId: CodeHighlightConfig = { engine: 'shiki' }
    const byAdapter: CodeHighlightConfig = { engine: minimalAdapter() }
    const byFactory: CodeHighlightConfig = {
      engine: () => minimalAdapter(),
    }

    expect(byId.engine).toBe('shiki')
    expect(typeof byFactory.engine).toBe('function')
    expect((byAdapter.engine as CodeHighlighterAdapter).name).toBe('minimal')
  })

  it('passes engine-specific options through untyped', () => {
    // `options` is the extension point an engine reads its own configuration
    // from. It is deliberately `Record<string, unknown>` rather than a union of
    // every engine's shape, for the same reason `CodeTheme` is open.
    const config: CodeHighlightConfig = {
      engine: 'shiki',
      options: {
        regexEngine: 'oniguruma',
        colorReplacements: { '#FF0000': '#00FF00' },
      },
    }

    expect(config.options?.regexEngine).toBe('oniguruma')
  })
})
