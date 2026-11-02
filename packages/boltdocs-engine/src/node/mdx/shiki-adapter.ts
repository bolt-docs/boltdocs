import { error as logError } from '@bdocs/dui'
import {
  normalizeCodeHighlightConfig,
  normalizeCodeTheme,
  parseMetaString,
  type ParsedMeta,
} from '@bdocs/unist-utils'
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
import type { CodeTheme as NormalizedCodeTheme } from '@bdocs/unist-utils'
import type { CodeToHastOptions } from '@shikijs/core'
import type { ShikiTransformer } from '@shikijs/types'
import { DEFAULT_THEMES, DEFAULTS, SHIKI_CLASSES } from './constants'

export {
  parseMetaString,
  type ParsedMeta,
} from '@bdocs/unist-utils'
export { ensureLanguage } from './highlighter'

/**
 * The meta object Shiki sees: the raw fence string plus every parsed property,
 * non-enumerable so `JSON.stringify` does not carry them.
 *
 * Pulled out of `getOptions()` so the result can be cached per parsed meta —
 * the non-enumerability is a `defineProperty` per key, and it produced the same
 * object for every block with the same fence.
 */
function buildMetaObject(
  parsedMeta: Record<string, unknown>,
  rawMeta: string,
): Record<string, unknown> {
  const metaObj: Record<string, unknown> = { __raw: rawMeta }
  for (const [key, value] of Object.entries(parsedMeta)) {
    if (key === '__raw') continue
    Object.defineProperty(metaObj, key, {
      value,
      enumerable: false,
      configurable: true,
      writable: true,
    })
  }
  return metaObj
}

/** Minimal config surface the Shiki adapter reads off `BoltdocsConfig`. */
export interface ShikiAdapterConfig {
  theme?: {
    codeTheme?: CodeTheme
    codeHighlighting?: CodeHighlightConfig | string
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

  /** The theme Shiki understands: a name, or a light/dark pair. */
  private theme: NormalizedCodeTheme
  private regexEngine: RegexEngineKind
  /** Shiki `colorReplacements`: theme token colors overridden per site. */
  private colorReplacements: Record<string, string> | null = null

  /**
   * The transformers, built once.
   *
   * All four are stateless: their `pre` hook reads `this.options` — which Shiki
   * binds per call — and nothing else, so one instance serves every block in the
   * process. They used to be rebuilt per code fence: four factory calls, four
   * objects and a fresh array, in the one place the build spends most of its
   * CPU. Highlighting is 96% of an MDX compile, so the per-block work here is
   * paid 971 times on the documentation site to produce something constant.
   */
  private transformers: ShikiTransformer[] | null = null

  /**
   * The theme part of every `getOptions()` result.
   *
   * Constant for the adapter's lifetime, so the per-block options object only
   * carries what actually varies: `lang` and `meta`.
   */
  private themeOptions: Record<string, unknown> | null = null

  /**
   * One runtime per adapter, not one per block.
   *
   * `initialize()` used to allocate an object and two closures on every call —
   * once per code fence — for a value that never changes. The adapter is a
   * singleton per configuration, so the runtime is too.
   */
  private runtime: Promise<CodeHighlighterRuntime> | null = null

  /**
   * Built Shiki meta objects, keyed by the parsed meta they came from.
   *
   * Turning "parsed meta" into "Shiki meta" defines every property as
   * non-enumerable — a `defineProperty` per key — and it is pure function of the
   * input. The pipeline hands over the same parsed object for every block that
   * shares a fence meta (install commands, config snippets), so the result is
   * reusable and the weak map keeps it from outliving that object.
   */
  private metaObjects = new WeakMap<object, Record<string, unknown>>()

  private getTransformers(): ShikiTransformer[] {
    if (!this.transformers) {
      this.transformers = [
        showLineNumbers(),
        showWordWrap(),
        addTitleProperty(),
        addLanguageProperty(),
      ]
    }
    return this.transformers
  }

  private getThemeOptions(): Record<string, unknown> {
    if (!this.themeOptions) {
      this.themeOptions = {
        ...(this.colorReplacements
          ? { colorReplacements: this.colorReplacements }
          : {}),
        ...(typeof this.theme === 'string'
          ? { theme: this.theme }
          : { themes: { light: this.theme.light, dark: this.theme.dark } }),
      }
    }
    return this.themeOptions
  }

  constructor(config?: ShikiAdapterConfig) {
    const highlighting = normalizeCodeHighlightConfig(
      config?.theme?.codeHighlighting,
    )
    // The public theme type is open — an engine with its own colour model
    // cannot be enumerated — and Shiki is not that engine. A theme Shiki
    // cannot use is dropped here, and the default takes its place, rather
    // than reaching Shiki as a pair of `undefined`s.
    this.theme = normalizeCodeTheme(highlighting?.theme) ??
      normalizeCodeTheme(config?.theme?.codeTheme) ?? {
        light: DEFAULT_THEMES.LIGHT,
        dark: DEFAULT_THEMES.DARK,
      }
    this.regexEngine =
      String(highlighting?.options?.regexEngine) === 'javascript'
        ? 'javascript'
        : 'oniguruma'
    const replacements = highlighting?.options?.colorReplacements
    if (
      replacements &&
      typeof replacements === 'object' &&
      !Array.isArray(replacements)
    ) {
      // Shiki stores theme token colors lowercase; a user-facing `#6A737D`
      // key never matches `#6a737d`. Normalize hex keys/values only —
      // symbolic keys like `editor.background` must stay untouched.
      const norm = (v: string) => {
        const t = v.trim()
        return /^#[0-9a-fA-F]{3,8}$/.test(t) ? t.toLowerCase() : t
      }
      this.colorReplacements = Object.fromEntries(
        Object.entries(replacements as Record<string, unknown>).map(
          ([k, v]) => [norm(k), norm(String(v))],
        ),
      )
    }
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
    if (!this.runtime) {
      this.runtime = (async () => {
        const highlighter = await this.getHighlighter()
        return {
          codeToHast: (code, options) =>
            highlighter.codeToHast(
              code,
              options as unknown as Parameters<
                typeof highlighter.codeToHast
              >[1],
            ),
          codeToHtml: async (code, options) =>
            highlighter.codeToHtml(
              code,
              options as unknown as Parameters<
                typeof highlighter.codeToHtml
              >[1],
            ),
        }
      })()
    }
    return this.runtime
  }

  /**
   * Ensure a language grammar is loaded into the engine backing this adapter.
   */
  async ensureLanguage(lang: string): Promise<boolean> {
    return ensureShikiLanguage(lang, this.regexEngine)
  }

  /**
   * Render code with no highlighting.
   *
   * Shiki has a real `plaintext` grammar, so this is a normal render — but the
   * pipeline reaches it through this method rather than by sending the id
   * itself, because the id is a Shiki convention and not part of the contract.
   * An engine without a plaintext grammar either implements this differently or
   * omits it; both are fine, and the framework falls back to an escaped `<pre>`.
   */
  async renderPlaintext(
    code: string,
    options: Record<string, unknown>,
  ): Promise<string> {
    try {
      const runtime = await this.initialize()
      return await runtime.codeToHtml(code, {
        ...options,
        lang: 'plaintext',
      })
    } catch (e) {
      logError(`[ShikiAdapter] Failed to render plaintext:`, e)
      return `<pre class="${SHIKI_CLASSES.FALLBACK}"><code>${escapeHtml(code)}</code></pre>`
    }
  }

  /**
   * Assembles Shiki options including transformers for a specific code block.
   */
  getOptions(lang: string, meta: unknown): Record<string, unknown> {
    let parsedMeta: ParsedMeta = {}
    let rawMeta = ''
    let metaSource: object | null = null

    if (typeof meta === 'string') {
      rawMeta = meta
      parsedMeta = parseMetaString(meta)
    } else if (meta && typeof meta === 'object') {
      const m = meta as ParsedMeta & { __raw?: string }
      parsedMeta = { ...m }
      rawMeta = String(m.__raw ?? '')
      // The caller's object, not the copy above: the pipeline reuses one parsed
      // meta object per distinct fence meta, which is what makes the weak map
      // hit for every block that shares one.
      metaSource = meta
    }

    const cachedMeta = metaSource ? this.metaObjects.get(metaSource) : undefined
    const metaObj =
      cachedMeta ??
      buildMetaObject(parsedMeta as Record<string, unknown>, rawMeta)
    if (metaSource && !cachedMeta) {
      this.metaObjects.set(metaSource, metaObj)
    }

    const options = {
      lang: lang || DEFAULTS.LANG,
      meta: metaObj,
      transformers: this.getTransformers(),
      ...this.getThemeOptions(),
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
 * Recreates only if the resolved highlighter configuration changes. Every
 * field that can influence rendered output must join this identity — a
 * missing field silently serves stale instances (colorReplacements was once
 * dropped here, pinning old token colors for a whole build).
 */
export function getShikiAdapter(config?: ShikiAdapterConfig): ShikiAdapter {
  const highlighting = normalizeCodeHighlightConfig(
    config?.theme?.codeHighlighting,
  )
  const theme = highlighting?.theme ?? config?.theme?.codeTheme
  const currentConfigStr = JSON.stringify({
    theme,
    regexEngine: highlighting?.options?.regexEngine ?? 'oniguruma',
    colorReplacements: highlighting?.options?.colorReplacements ?? null,
  })

  if (_adapterInstance === null || _adapterConfigStr !== currentConfigStr) {
    _adapterInstance = new ShikiAdapter(config)
    _adapterConfigStr = currentConfigStr
  }
  return _adapterInstance
}

/**
 * Starts building the highlighter in the background. The highlighter build
 * is a few hundred milliseconds of synchronous CPU (TextMate grammar
 * parsing), so it must never run on the critical path of Vite's server setup.
 * The underlying `highlight()` promise is module-level, so callers that need
 * the highlighter later share the same in-flight build.
 */
export function prewarmShiki(config?: ShikiAdapterConfig): void {
  getShikiAdapter(config).prewarm()
}
