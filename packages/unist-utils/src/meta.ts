/**
 * Parsed metadata extracted from the fenced-code-block info string.
 *
 * Mirrors what `parseMetaString` returns for shiki's `meta.__raw`, but is
 * consumed by both shiki-adapter and any plugin that customises code-fence
 * behaviour (e.g. line-number toggles, title label, etc.).
 */
export interface ParsedMeta {
  title?: string
  lineNumbers?: boolean
  wordWrap?: boolean
  /**
   * Raw original meta string. `parseMetaString(metaStr)` does NOT set this
   * field; it is attached by callers (e.g. `shiki-adapter` in Boltdocs
   * core) when they pass the meta string into the highlighter, so
   * downstream consumers can recover the original unparsed text.
   */
  __raw?: string
  [key: string]: unknown
}

/**
 * Parse a fenced-code-block meta string (the part after the language tag
 * inside ```ts title="foo" lineNumbers```) into a structured object.
 *
 * Recognised flags:
 *   - `title="..."`  →  string in `title`.
 *   - `lineNumbers` / `showLineNumbers`  →  boolean in `lineNumbers`.
 *   - `wordWrap` / `word-wrap`  →  boolean in `wordWrap`.
 *
 * Unknown keys are not extracted (the shiki highlighter consumes them
 * via the `meta.__raw` raw string), so this helper stays minimal and
 * allocation-cheap.
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
