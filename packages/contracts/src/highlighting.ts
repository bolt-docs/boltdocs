export type CodeTheme = string | { light: string; dark: string }

export interface ParsedMetaLike {
  title?: string
  lineNumbers?: boolean
  wordWrap?: boolean
  __raw?: string
  [key: string]: unknown
}

export interface CodeHighlighterRuntime {
  codeToHast(code: string, options: Record<string, unknown>): unknown
  codeToHtml(code: string, options: Record<string, unknown>): Promise<string>
}

export interface CodeHighlighterAdapter {
  name: string
  version?: string
  getOptions(lang: string, meta: ParsedMetaLike): Record<string, unknown>
  initialize(): Promise<CodeHighlighterRuntime>
  ensureLanguage?(lang: string): Promise<boolean>
  prewarm?(options?: Record<string, unknown>): void | Promise<void>
}

export type CodeHighlighterEngine =
  | string
  | CodeHighlighterAdapter
  | ((
      config: CodeHighlightConfig,
    ) => CodeHighlighterAdapter | Promise<CodeHighlighterAdapter>)

export interface CodeHighlightConfig {
  engine?: CodeHighlighterEngine
  theme?: CodeTheme
  options?: Record<string, unknown>
}
