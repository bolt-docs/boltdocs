import { error as logError } from '@bdocs/dui'
import { escapeHtml } from '../utils'
import { highlight } from './highlighter'
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

  if (/lineNumbers|showLineNumbers/.test(metaStr)) {
    result.lineNumbers = true
  }
  if (/wordWrap|word-wrap/.test(metaStr)) {
    result.wordWrap = true
  }

  const titleMatch = metaStr.match(/title=(["'])(.*?)\1/)
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

    const options = {
      lang: lang || DEFAULTS.LANG,
      meta: {
        __raw: rawMeta,
        ...parsedMeta,
      },
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
