import { error as logError } from '@bdocs/dui'
import { parseMetaString, type ParsedMeta } from '@bdocs/unist-utils'
import { escapeHtml } from '../utils'
import { ensureLanguage as ensureShikiLanguage, highlight } from './highlighter'
import type { RegexEngineKind } from './highlighter'
import { showLineNumbers } from './transformers/show-line-numbers'
import { showWordWrap } from './transformers/show-word-wrap'
import {
  addTitleProperty,
  addLanguageProperty,
} from './transformers/add-to-pre-element'
import type {
  CodeHighlighterAdapter,
  CodeHighlighterRuntime,
  CodeHighlightConfig,
  CodeTheme,
} from '../../shared/types'
import type { CodeToHastOptions } from 'shiki'
import { DEFAULT_THEMES, DEFAULTS, SHIKI_CLASSES } from './constants'

export {
  parseMetaString,
  type ParsedMeta,
} from '@bdocs/unist-utils'
export { ensureLanguage } from './highlighter'

/** Minimal config surface the Shiki adapter reads off `BoltdocsConfig`. */
export interface ShikiAdapterConfig {
  theme?: {
    codeTheme?: CodeTheme
    codeHighlighting?: CodeHighlightConfig
  }
}

/**
 * Unified Shiki Adapter for Boltdocs.
 *
 * Implements the engine-agnostic {@link CodeHighlighterAdapter} SPI so the
 * core never talks to Shiki directly. Centralizes theme resolution,
 * transformer configuration, and rendering logic.
 */
export class ShikiAdapter implements CodeHighlighterAdapter {
  name = 'shiki'
  version = '3.23.0'

  private theme: CodeTheme
  private regexEngine: RegexEngineKind

  constructor(config?: ShikiAdapterConfig) {
    const highlighting = config?.theme?.codeHighlighting
    this.theme = (highlighting?.theme ??
      config?.theme?.codeTheme ??
      ({
        light: DEFAULT_THEMES.LIGHT,
        dark: DEFAULT_THEMES.DARK,
      } satisfies CodeTheme)) as CodeTheme
    this.regexEngine =
      String(highlighting?.options?.regexEngine) === 'javascript'
        ? 'javascript'
        : 'oniguruma'
  }

  /**
   * Resolves the code theme from the engine-agnostic configuration.
   */
  getTheme(): CodeTheme {
    return this.theme
  }

  /**
   * Creates a Shiki highlighter instance with the configured theme/engine.
   */
  async getHighlighter() {
    return await highlight({ regexEngine: this.regexEngine })
  }

  /**
   * Initializes the adapter and returns the runtime used by the render
   * pipeline. The underlying build is module-level, so callers share the
   * same in-flight highlighter.
   */
  async initialize(): Promise<CodeHighlighterRuntime> {
    const highlighter = await this.getHighlighter()
    return {
      codeToHast: (code, options) =>
        highlighter.codeToHast(
          code,
          options as unknown as Parameters<typeof highlighter.codeToHast>[1],
        ),
      codeToHtml: async (code, options) =>
        highlighter.codeToHtml(
          code,
          options as unknown as Parameters<typeof highlighter.codeToHtml>[1],
        ),
    }
  }

  /**
   * Ensure a language grammar is loaded into the engine backing this adapter.
   */
  async ensureLanguage(lang: string): Promise<boolean> {
    return ensureShikiLanguage(lang, this.regexEngine)
  }

  /**
   * Assembles Shiki options including transformers for a specific code block.
   */
  getOptions(lang: string, meta: unknown): Record<string, unknown> {
    let parsedMeta: ParsedMeta = {}
    let rawMeta = ''

    if (typeof meta === 'string') {
      rawMeta = meta
      parsedMeta = parseMetaString(meta)
    } else if (meta && typeof meta === 'object') {
      const m = meta as ParsedMeta & { __raw?: string }
      parsedMeta = { ...m }
      rawMeta = String(m.__raw ?? '')
    }

    const metaObj: Record<string, unknown> = {
      __raw: rawMeta,
    }

    for (const [key, value] of Object.entries(parsedMeta)) {
      if (key === '__raw') continue
      Object.defineProperty(metaObj, key, {
        value,
        enumerable: false,
        configurable: true,
        writable: true,
      })
    }

    const options = {
      lang: lang || DEFAULTS.LANG,
      meta: metaObj,
      transformers: [
        showLineNumbers(),
        showWordWrap(),
        addTitleProperty(),
        addLanguageProperty(),
      ],
      ...(typeof this.theme === 'string'
        ? { theme: this.theme }
        : {
            themes: { light: this.theme.light, dark: this.theme.dark },
          }),
    } as CodeToHastOptions

    return options as unknown as Record<string, unknown>
  }

  /**
   * Renders code to HTML using the Boltdocs Shiki pipeline.
   * Safely handles highlighter exceptions by falling back to escaped pre.
   */
  async render(
    code: string,
    lang: string,
    meta: string | Record<string, unknown>,
  ): Promise<string> {
    try {
      const options = this.getOptions(lang, meta)
      const runtime = await this.initialize()
      return await runtime.codeToHtml(code, options)
    } catch (e) {
      logError(`[ShikiAdapter] Failed to render code:`, e)
      return `<pre class="${SHIKI_CLASSES.FALLBACK}"><code>${escapeHtml(code)}</code></pre>`
    }
  }

  /**
   * Warm the highlighter off the critical path (never awaited).
   */
  prewarm(_options?: Record<string, unknown>): void {
    void highlight({ regexEngine: this.regexEngine }).catch(() => {})
  }
}

// Module-level singleton adapter caching logic
let _adapterInstance: ShikiAdapter | null = null
let _adapterConfigStr: string | undefined

/**
 * Returns a cached ShikiAdapter instance.
 * Recreates only if the resolved theme or regex engine configuration changes.
 */
export function getShikiAdapter(config?: ShikiAdapterConfig): ShikiAdapter {
  const highlighting = config?.theme?.codeHighlighting
  const theme = highlighting?.theme ?? config?.theme?.codeTheme
  const currentConfigStr = JSON.stringify({
    theme,
    regexEngine: highlighting?.options?.regexEngine ?? 'oniguruma',
  })

  if (_adapterInstance === null || _adapterConfigStr !== currentConfigStr) {
    _adapterInstance = new ShikiAdapter(config)
    _adapterConfigStr = currentConfigStr
  }
  return _adapterInstance
}

/**
 * Starts building the highlighter in the background. The highlighter build
 * is ~2.5s of synchronous CPU (TextMate grammar parsing), so it must never
 * run on the critical path of Vite's server setup. The underlying
 * `highlight()` promise is module-level, so callers that need the
 * highlighter later share the same in-flight build.
 */
export function prewarmShiki(config?: ShikiAdapterConfig): void {
  getShikiAdapter(config).prewarm()
}
