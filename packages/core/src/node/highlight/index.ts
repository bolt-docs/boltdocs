export type {
  CodeHighlighterAdapter,
  CodeHighlighterRuntime,
  CodeHighlightConfig,
  CodeHighlighterEngine,
  CodeTheme,
} from '../../shared/types'

export {
  DEFAULT_HIGHLIGHTER,
  BUILTIN_HIGHLIGHTERS,
  registerHighlighter,
  isHighlighterRegistered,
  getHighlighterNames,
  getCodeHighlighterAdapter,
  prewarmCodeHighlighting,
  prewarmHighlighter,
  type HighlighterFactory,
} from './registry'
