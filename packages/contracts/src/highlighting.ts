/**
 * A code theme.
 *
 * Open by design. `'github-dark'` and `{ light, dark }` cover engines that take
 * named themes, and both are what Shiki understands. An engine with its own
 * colour model — semantic tokens, CSS custom properties, a class map — cannot
 * express itself through either, and an adapter is better placed to interpret
 * it than a type is to enumerate every engine that will ever exist.
 */
export type CodeTheme =
  | string
  | { light: string; dark: string }
  | { tokens: Record<string, string> }
  | Record<string, unknown>

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
  /**
   * Render code with no highlighting applied.
   *
   * The pipeline needs this when a grammar fails: it degrades the block to
   * plain text rather than dropping it. It asks here instead of calling
   * `codeToHtml` with `lang: 'plaintext'`, because that id is Shiki's, not
   * the contract's — an engine that has never heard of it throws, and the
   * fallback the caller reached for then fails the same way the original did.
   *
   * Optional. When absent the framework renders an escaped `<pre>` itself, so
   * an adapter never has to implement this to be usable.
   */
  renderPlaintext?(
    code: string,
    options: Record<string, unknown>,
  ): Promise<string>
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
