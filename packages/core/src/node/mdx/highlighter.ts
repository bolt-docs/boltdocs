import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import {
  type HighlighterCore,
  type RegexEngine,
  createHighlighterCore,
} from 'shiki/core'
import { THEMES_BUILD } from './shiki-themes'
import { LANG_BUILD, type Languages } from './shiki-langs'
import type { ShikiTheme } from '../../shared/types'

let jsEngine: RegexEngine | null = null
let highlighter: Promise<HighlighterCore> | null = null

const getJsEngine = (): RegexEngine => {
  jsEngine ??= createJavaScriptRegexEngine()
  return jsEngine
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
    engine: getJsEngine(),
  })

  return highlighter
}

export { highlight, type Languages }
