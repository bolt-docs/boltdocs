import { error as logError } from '@bdocs/dui'
import { escapeHtml } from '../utils'
import { ensureLanguage, highlight } from './highlighter'

export { ensureLanguage }
import { showLineNumbers } from './transformers/show-line-numbers'
import { showWordWrap } from './transformers/show-word-wrap'
import {
  addTitleProperty,
  addLanguageProperty,
} from './transformers/add-to-pre-element'
import type { BoltdocsConfig } from '../config'
import type { ShikiTheme } from '../../shared/types'
import type { CodeToHastOptions } from 'shiki'
import { DEFAULT_THEMES, DEFAULTS, SHIKI_CLASSES } from './constants'

export interface ParsedMeta {
  title?: string
  lineNumbers?: boolean
  wordWrap?: boolean
  [key: string]: any
}

/**
 * Parses a meta string into a structured ParsedMeta object.
 */
export function parseMetaString(metaStr: string): ParsedMeta {
  const result: ParsedMeta = {}
  if (!metaStr) return result

  const setBooleanFlag = (
    key: 'lineNumbers' | 'wordWrap',
    value?: string,
  ): void => {
    if (value === 'false') {
      result[key] = false
      return
    }
    if (value === 'true' || value === undefined) {
      result[key] = true
    }
  }

  const lineMatches = Array.from(
    metaStr.matchAll(
      /(?:^|\s)(?:lineNumbers|showLineNumbers|show-line-numbers|show_line_numbers|line_numbers)(?:\s*=\s*(true|false))?(?=\s|$)/gi,
    ),
  )
  const lastLineMatch = lineMatches[lineMatches.length - 1]
  if (lastLineMatch) {
    setBooleanFlag('lineNumbers', lastLineMatch[1])
  }

  const wordMatches = Array.from(
    metaStr.matchAll(
      /(?:^|\s)(?:wordWrap|word-wrap|word_wrap)(?:\s*=\s*(true|false))?(?=\s|$)/gi,
    ),
  )
  const lastWordMatch = wordMatches[wordMatches.length - 1]
  if (lastWordMatch) {
    setBooleanFlag('wordWrap', lastWordMatch[1])
  }

  const titleMatch = metaStr.match(/title=(['"])(.*?)\1/)
  if (titleMatch) {
    result.title = titleMatch[2]
  }

  return result
}

/**
 * Unified Shiki Adapter for Boltdocs.
 * Centralizes theme resolution, transformer configuration, and rendering logic.
 */
export class ShikiAdapter {
  private config: BoltdocsConfig | undefined

  constructor(config?: BoltdocsConfig) {
    this.config = config
  }

  /**
   * Resolves the code theme from Boltdocs configuration.
   */
  getTheme(): ShikiTheme | { light: ShikiTheme; dark: ShikiTheme } {
    return (
      (this.config?.theme?.codeTheme as
        | ShikiTheme
        | { light: ShikiTheme; dark: ShikiTheme }
        | undefined) || {
        light: DEFAULT_THEMES.LIGHT as ShikiTheme,
        dark: DEFAULT_THEMES.DARK as ShikiTheme,
      }
    )
  }

  /**
   * Creates a Shiki highlighter instance with the configured themes.
   */
  async getHighlighter() {
    return await highlight(this.getTheme())
  }

  /**
   * Assembles Shiki options including transformers for a specific code block.
   */
  getOptions(lang: string, meta: string | ParsedMeta): CodeToHastOptions {
    const theme = this.getTheme()

    let parsedMeta: ParsedMeta = {}
    let rawMeta = ''

    if (typeof meta === 'string') {
      rawMeta = meta
      parsedMeta = parseMetaString(meta)
    } else if (meta) {
      parsedMeta = meta
      rawMeta = meta.__raw || ''
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
    } as CodeToHastOptions

    if (typeof theme === 'object') {
      ;(options as unknown as { themes?: unknown }).themes = {
        light: theme.light,
        dark: theme.dark,
      }
    } else {
      ;(options as unknown as { theme?: unknown }).theme = theme
    }

    return options
  }

  /**
   * Renders code to HTML using the Boltdocs Shiki pipeline.
   * Safely handles highlighter exceptions by falling back to escaped pre.
   */
  async render(
    code: string,
    lang: string,
    meta: string | ParsedMeta,
  ): Promise<string> {
    try {
      await ensureLanguage(lang || DEFAULTS.LANG)
      const highlighter = await this.getHighlighter()
      const options = this.getOptions(lang, meta)
      return highlighter.codeToHtml(code, options)
    } catch (e) {
      logError(`[ShikiAdapter] Failed to render code:`, e)
      return `<pre class="${SHIKI_CLASSES.FALLBACK}"><code>${escapeHtml(code)}</code></pre>`
    }
  }
}

// Module-level singleton adapter caching logic
let _adapterInstance: ShikiAdapter | null = null
let _adapterThemeConfigStr: string | undefined

/**
 * Returns a cached ShikiAdapter instance.
 * Recreates only if the relevant codeTheme configuration values change deeply.
 */
export function getShikiAdapter(config?: BoltdocsConfig): ShikiAdapter {
  const currentThemeStr = JSON.stringify(config?.theme?.codeTheme || null)

  if (_adapterInstance === null || _adapterThemeConfigStr !== currentThemeStr) {
    _adapterInstance = new ShikiAdapter(config)
    _adapterThemeConfigStr = currentThemeStr
  }
  return _adapterInstance
}

/**
 * Starts building the highlighter in the background. The highlighter build
 * is ~2.5s of synchronous CPU (TextMate grammar parsing for every theme and
 * language), so it must never run on the critical path of Vite's server
 * setup. The underlying `highlight()` promise is module-level, so callers
 * that need the highlighter later share the same in-flight build.
 */
export function prewarmShiki(config?: BoltdocsConfig): void {
  getShikiAdapter(config)
    .getHighlighter()
    .catch(() => {})
}
