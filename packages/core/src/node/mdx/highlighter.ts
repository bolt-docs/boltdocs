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
  onigEngine ??= createOnigurumaEngine(import('shiki/wasm'))
  return onigEngine
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

export { highlight, type Languages }
