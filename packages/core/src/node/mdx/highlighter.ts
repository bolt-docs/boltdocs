import { createOnigurumaEngine } from '@shikijs/engine-oniguruma'
import {
  type HighlighterCore,
  type RegexEngine,
  createHighlighterCore,
} from 'shiki/core'
import { THEMES_BUILD } from './shiki-themes'
import { LANG_BUILD, type Languages } from './shiki-langs'
import type { ShikiTheme } from '../../shared/types'

let onigEngine: RegexEngine | null = null
let highlighter: Promise<HighlighterCore> | null = null

const getOnigEngine = (): RegexEngine => {
  if (!onigEngine) onigEngine = createOnigurumaEngine(import('shiki/wasm'))
  return onigEngine as RegexEngine
}

/**
 * Main Shiki Highlighter Factory.
 *
 * @param codeTheme - The theme configuration (can be a string or a light/dark object)
 */
const highlight = async (
  _codeTheme?: ShikiTheme | { light: ShikiTheme; dark: ShikiTheme },
): Promise<HighlighterCore> => {
  if (highlighter) return highlighter

  highlighter = createHighlighterCore({
    themes: THEMES_BUILD,
    langs: LANG_BUILD,
    engine: getOnigEngine(),
  })

  return highlighter
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
  ): Promise<Parameters<HighlighterCore['codeToHast']>[1]> {
    const highlighter = await this.highlighterPromise
    return highlighter.codeToHast(code, options)
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
