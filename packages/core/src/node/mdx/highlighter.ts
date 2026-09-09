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

let highlighterPromise: Promise<HighlighterCore> | null = null

async function getOnigEngineImpl(): Promise<RegexEngine> {
  const wasm = await import('shiki/wasm')
  return createOnigurumaEngine(
    wasm as unknown as Parameters<typeof createOnigurumaEngine>[0],
  ) as unknown as RegexEngine
}

/**
 * Main Shiki Highlighter Factory.
 *
 * Only COMMON_LANGS are registered eagerly — loading every bundled TextMate
 * grammar up front costs ~2.5s of synchronous CPU. Languages outside the
 * common set are loaded lazily via {@link ensureLanguage}.
 *
 * @param codeTheme - The theme configuration (can be a string or a light/dark object)
 */
const highlight = async (
  _codeTheme?: ShikiTheme | { light: ShikiTheme; dark: ShikiTheme },
): Promise<HighlighterCore> => {
  if (highlighterPromise) return highlighterPromise

  highlighterPromise = (async () => {
    const startTime = performance.now()
    const engine = await getOnigEngineImpl()
    const instance = await createHighlighterCore({
      themes: THEMES_BUILD,
      langs: COMMON_LANGS,
      engine,
    })
    if (process.env.BOLTDOCS_DEBUG === 'true') {
      // eslint-disable-next-line no-console
      console.log(
        `[boltdocs] shiki-ready in ${Math.round(performance.now() - startTime)}ms (${COMMON_LANGS.length} langs)`,
      )
    }
    return instance
  })()

  return highlighterPromise
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
): Promise<boolean> {
  const lang = normalizeLanguage(rawLang)
  if (!lang) return true

  let highlighter: HighlighterCore
  try {
    highlighter = await highlight()
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

export { highlight, type Languages }
