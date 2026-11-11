/**
 * @bdocs/highlight — Syntax highlighter for Boltdocs, powered by Prism.
 *
 * Implements the engine-agnostic `CodeHighlighterAdapter` contract with Prism's
 * tokenization for accurate highlighting and broad language coverage, while
 * emitting Boltdocs' `bd-token-*` classes (themed via CSS variables) alongside
 * Prism's `token` classes for maximum theme/control flexibility.
 */

import type { CodeHighlightConfig } from '@bdocs/contracts'
import { HighlightAdapter } from './adapter.js'

export { HighlightAdapter } from './adapter.js'
export type {
  CodeHighlighterAdapter,
  CodeHighlighterRuntime,
  CodeHighlightConfig,
} from '@bdocs/contracts'

export { normalizeTheme, type ThemeMap } from './themes.js'
export { canonicalLanguage, ensurePrismLanguage, ALIASES } from './languages.js'

export const ADAPTER_NAME = 'highlight'

export function createHighlightAdapter(
  config?: CodeHighlightConfig,
): HighlightAdapter {
  return new HighlightAdapter(config)
}

export default createHighlightAdapter

export { ADAPTER_NAME as defaultEngineId }
