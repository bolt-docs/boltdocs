import { createOnigurumaEngine } from '@shikijs/engine-oniguruma'
import {
  type HighlighterCore,
  type RegexEngine,
  createHighlighterCore,
} from 'shiki/core'
import { THEMES_BUILD } from './shiki-themes'
import {
  COMMON_LANGS,
  LAZY_LANG_IMPORTS,
  normalizeLanguage,
  type Languages,
} from './shiki-langs'
import type { ShikiTheme } from '../../shared/types'

/** Which regex engine backs the Shiki core. `oniguruma` is the default. */
export type RegexEngineKind = 'oniguruma' | 'javascript'

/**
 * Per-engine highlighter promises. `createHighlighterCore` is heavy (~2.5s of
 * synchronous CPU) so each engine variant builds at most once per process and
 * every caller sharing the same `regexEngine` reuses the same in-flight build.
 */
const highlighterPromises = new Map<RegexEngineKind, Promise<HighlighterCore>>()

async function getOnigEngineImpl(): Promise<RegexEngine> {
  const wasm = await import('shiki/wasm')
  return createOnigurumaEngine(
    wasm as unknown as Parameters<typeof createOnigurumaEngine>[0],
  ) as unknown as RegexEngine
}

async function getJsEngineImpl(): Promise<RegexEngine> {
  const { createJavaScriptRegexEngine } = await import(
    'shiki/engine/javascript'
  )
  return createJavaScriptRegexEngine() as unknown as RegexEngine
}

async function resolveEngine(kind: RegexEngineKind): Promise<RegexEngine> {
  return kind === 'javascript' ? getJsEngineImpl() : getOnigEngineImpl()
}

/**
 * Main Shiki Highlighter Factory.
 *
 * Only COMMON_LANGS are registered eagerly — loading every bundled TextMate
 * grammar up front costs ~2.5s of synchronous CPU. Languages outside the
 * common set are loaded lazily via {@link ensureLanguage}.
 *
 * The JavaScript regex engine (`regexEngine: 'javascript'`) swaps the
 * Oniguruma WASM engine for a native JS implementation, cutting startup to
 * ~200ms at the cost of regex fidelity for exotic grammars — aimed at faster
 * dev-server warm starts.
 */
const highlight = async (options?: {
  regexEngine?: RegexEngineKind
}): Promise<HighlighterCore> => {
  const kind: RegexEngineKind =
    options?.regexEngine === 'javascript' ? 'javascript' : 'oniguruma'
  const cached = highlighterPromises.get(kind)
  if (cached) return cached

  const promise = (async () => {
    const startTime = performance.now()
    const engine = await resolveEngine(kind)
    const instance = await createHighlighterCore({
      themes: THEMES_BUILD,
      langs: COMMON_LANGS,
      engine,
    })
    if (process.env.BOLTDOCS_DEBUG === 'true') {
      // eslint-disable-next-line no-console
      console.log(
        `[boltdocs] shiki-ready in ${Math.round(performance.now() - startTime)}ms (${kind}, ${COMMON_LANGS.length} langs)`,
      )
    }
    return instance
  })()

  highlighterPromises.set(kind, promise)
  return promise
}

/** In-flight and completed lazy language loads, keyed by canonical name. */
const pendingLangLoads = new Map<string, Promise<boolean>>()

/**
 * Ensure a Shiki language grammar is loaded before rendering.
 *
 * Resolves fence-info aliases (e.g. `yml` → `yaml`, `shell` → `bash`),
 * dynamically imports the grammar if it is not already registered, and
 * caches concurrent loads so a page with many blocks of the same language
 * only loads it once.
 *
 * @returns true when the language is available (or needs no grammar),
 *          false when it is unknown to this bundle or failed to load.
 */
export async function ensureLanguage(
  rawLang: string | undefined,
  regexEngine: RegexEngineKind = 'oniguruma',
): Promise<boolean> {
  const lang = normalizeLanguage(rawLang)
  if (!lang) return true

  let highlighter: HighlighterCore
  try {
    highlighter = await highlight({ regexEngine })
  } catch {
    return false
  }

  let loaded: string[] = []
  try {
    loaded = highlighter.getLoadedLanguages()
  } catch {
    loaded = []
  }
  if (loaded.includes(lang)) return true

  const existing = pendingLangLoads.get(lang)
  if (existing) return existing

  const importer = LAZY_LANG_IMPORTS[lang]
  if (!importer) return false

  const task = (async () => {
    try {
      const mod = await importer()
      const grammar = (mod as { default?: unknown })?.default ?? mod
      await highlighter.loadLanguage(
        grammar as Parameters<HighlighterCore['loadLanguage']>[0],
      )
      return true
    } catch {
      return false
    } finally {
      pendingLangLoads.delete(lang)
    }
  })()
  pendingLangLoads.set(lang, task)
  return task
}

/**
 * Highlighter factory function that exposes both legacy and new API methods.
 * Maintains backward compatibility while enabling new HTML-based rendering.
 */
export class ShikiHighlighter {
  private highlighterPromise: Promise<HighlighterCore>

  constructor() {
    this.highlighterPromise = highlight()
  }

  async getHighlighter(): Promise<HighlighterCore> {
    return this.highlighterPromise
  }

  /**
   * Legacy method for backward compatibility.
   * Uses HAST to generate inline-styled HTML (the old behavior).
   */
  async codeToHast(
    code: string,
    options: Parameters<HighlighterCore['codeToHast']>[1],
  ): Promise<unknown> {
    const highlighter = await this.highlighterPromise
    return highlighter.codeToHast(
      code,
      options as unknown as Parameters<HighlighterCore['codeToHast']>[1],
    ) as unknown
  }
  /**
   * New method for CSS-based HTML generation.
   * Generates HTML with CSS classes instead of inline styles.
   */
  async codeToHtml(
    code: string,
    options: Parameters<HighlighterCore['codeToHtml']>[1],
  ): Promise<string> {
    const highlighter = await this.highlighterPromise
    return highlighter.codeToHtml(code, options)
  }
}

let _highlighterInstance: ShikiHighlighter | null = null

/**
 * Export a singleton instance of ShikiHighlighter for use throughout the application.
 */
export const highlighter = (): ShikiHighlighter => {
  if (!_highlighterInstance) {
    _highlighterInstance = new ShikiHighlighter()
  }
  return _highlighterInstance
}

export { highlight, type ShikiTheme, type Languages }
