export const MDX_NODES = {
  JSX_FLOW_ELEMENT: 'mdxJsxFlowElement' as const,
  JSX_TEXT_ELEMENT: 'mdxJsxTextElement' as const,
  JSX_ATTRIBUTE: 'mdxJsxAttribute' as const,
  ELEMENT: 'element' as const,
  TEXT: 'text' as const,
  CODE: 'code' as const,
}

export const COMPONENT_PREVIEW = 'ComponentPreview'

export const ATTRIBUTES = {
  CODE: 'code',
  LINE_NUMBERS: 'lineNumbers',
  SHOW_LINE_NUMBERS: 'showLineNumbers',
  WORD_WRAP: 'wordWrap',
  WORD_WRAP_HYPHEN: 'word-wrap',
  TITLE: 'title',
  HIGHLIGHTED_HTML: 'highlightedHtml',
}

export const HTML_TAGS = {
  PRE: 'pre',
  CODE: 'code',
}

export const DATA_ATTRIBUTES = {
  TITLE: 'data-title',
  LANG: 'data-lang',
  HIGHLIGHTED: 'data-highlighted',
  HIGHLIGHTED_HTML: 'data-highlighted-html',
}

export const SHIKI_CLASSES = {
  LINE_NUMBERS: 'shiki-line-numbers',
  WORD_WRAP: 'shiki-word-wrap',
  FALLBACK: 'shiki-fallback',
}

export const DEFAULT_THEMES = {
  LIGHT: 'github-light',
  DARK: 'github-dark',
}

export const DEFAULTS = {
  LANG: 'plaintext',
  MDX_DEFAULT_LANG: 'text',
}
