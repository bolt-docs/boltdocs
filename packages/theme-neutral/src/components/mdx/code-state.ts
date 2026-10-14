/**
 * Reading the state a code block was rendered in, without naming an engine.
 *
 * Every function here used to be a guess about Shiki's output, duplicated
 * across three files. The guess was load-bearing — a block that failed to be
 * recognised as highlighted rendered unstyled, and a block whose line count came
 * out as one never expanded — so replacing it is not cosmetic.
 *
 * The pipeline emits the answers as attributes: `data-code-state` for what
 * happened to the block, `data-line-count` for how tall it is. This module reads
 * them, and knows nothing about how any engine produces them.
 */

/**
 * What state a code block is in.
 *
 * `highlighted` — an engine rendered it with syntax colouring.
 * `plaintext`   — an engine rendered it, but the language had no grammar.
 * `fallback`    — no engine could render it; the code is shown as-is.
 * `none`        — nothing claimed the block (no search plugin configured).
 */
export type CodeBlockState = 'highlighted' | 'plaintext' | 'fallback' | 'none'

const VALID_STATES = new Set<string>([
  'highlighted',
  'plaintext',
  'fallback',
  'none',
])

/**
 * Read the state from props, in order of authority.
 *
 * `data-code-state` is authoritative and `data-highlighted` is the older,
 * coarser signal kept for a plugin that emits only that. The class name is not
 * consulted at all: it used to be, via `className.includes('shiki')`, which meant
 * the view silently decided that any engine not named Shiki had produced
 * nothing.
 */
export function readCodeBlockState(props: {
  'data-code-state'?: unknown
  'data-highlighted'?: unknown
}): CodeBlockState {
  const state = props['data-code-state']
  if (typeof state === 'string' && VALID_STATES.has(state)) {
    return state as CodeBlockState
  }

  const highlighted = props['data-highlighted']
  if (typeof highlighted === 'string') {
    return highlighted === 'true' ? 'highlighted' : 'fallback'
  }

  return 'none'
}

/**
 * Whether the block carries syntax colouring.
 *
 * `plaintext` counts as rendered but not coloured: an engine produced the
 * markup, so the block should keep engine styling, and only the tokens are
 * absent.
 */
export function isHighlighted(state: CodeBlockState): boolean {
  return state === 'highlighted'
}

/**
 * Strip Shiki's empty trailing line span.
 *
 * Shiki closes a block with an empty `<span class="line">`, which renders as a
 * blank line at the bottom of every code block. The fix stays here, in one
 * place, because it was previously copy-pasted into two components and the two
 * copies had already begun to drift.
 *
 * It is a regular expression over engine output, which is the thing this module
 * exists to stop doing. It remains because the alternative — a post-render DOM
 * pass — costs a reflow per block, and because an engine that does not emit
 * this markup simply matches nothing. A block from an unknown engine is left
 * byte-for-byte alone.
 */
export function cleanHighlightedHtml(html: string): string {
  return html.replace(
    /<span class="line">\s*(?:<span[^>]*>\s*<\/span>)?\s*<\/span>\s*(<\/code>\s*<\/pre>)/g,
    '$1',
  )
}

/**
 * How many lines a rendered block has.
 *
 * Prefers the count the pipeline emits, because counting engine markup in the
 * view means every new engine is a bug report. Falls back to a line split for a
 * plain `<pre>`, and finally to zero, which renders as "not expandable" — the
 * safe direction: a block that cannot be measured is not collapsed in a way
 * that hides its content.
 */
export function readLineCount(
  props: {
    'data-line-count'?: unknown
  },
  highlightedHtml?: string,
  children?: unknown,
): number {
  const declared = Number(props['data-line-count'])
  if (Number.isFinite(declared) && declared > 0) return Math.trunc(declared)

  if (highlightedHtml) {
    // The last resort for an engine that emits no count. Count sibling elements
    // inside the code area — the shape most engines use for a line — rather
    // than matching any engine's opening tag, which is the guess this whole
    // module exists to remove.
    const codeArea = /<code[^>]*>([\s\S]*)<\/code>/.exec(highlightedHtml)
    const body = codeArea?.[1] ?? highlightedHtml
    const lineElements = body.match(/<(div|p|span)(?:\s[^>]*)?>[\s\S]*?<\/\1>/g)
    if (lineElements && lineElements.length > 0) return lineElements.length

    // No per-line wrappers at all: count the text's own newlines.
    const text = body.replace(/<[^>]+>/g, '')
    return text.trim() ? text.trim().split('\n').length : 0
  }

  const text =
    typeof children === 'string'
      ? children
      : Array.isArray(children)
        ? children.filter((c) => typeof c === 'string').join('\n')
        : ''

  return text ? text.trim().split('\n').length : 0
}

/**
 * Whether a block is long enough to offer expand/collapse.
 *
 * A threshold rather than a hard rule: a three-line block that happens to be
 * wide has nothing to hide, and a fifty-line block of shell flags is useful
 * even though every line is short.
 */
export const EXPANDABLE_MIN_LINES = 12

export function shouldOfferExpand(lineCount: number): boolean {
  return lineCount > EXPANDABLE_MIN_LINES
}
