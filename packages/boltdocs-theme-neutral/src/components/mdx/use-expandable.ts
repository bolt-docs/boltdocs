import { useEffect, useRef, useState } from 'react'
import { readLineCount } from './code-state'

export interface UseExpandableOptions {
  /** The raw children rendered inside the code area (for line counting). */
  children?: React.ReactNode
  /** Pre-rendered engine HTML when available (for line counting). */
  highlightedHtml?: string
  /** Line count published by the pipeline. Preferred over counting. */
  lineCount?: number
  /** Number of lines above which the block becomes expandable. @default 6 */
  maxLines?: number
}

/**
 * Expand / collapse behavior for long code blocks. Measures the rendered code
 * through `preRef` and exposes whether the block is expandable, whether it
 * should be visually truncated, and a toggle handler.
 */
export function useExpandable(options: UseExpandableOptions = {}) {
  const { children, highlightedHtml, lineCount, maxLines = 6 } = options
  const [isExpanded, setIsExpanded] = useState(false)

  /**
   * Seed the expandable state from a count the server already computed.
   *
   * The block measures itself against the live DOM, which does not exist during
   * server rendering, so the flag started as `false` on both sides and the
   * client's `useEffect` then flipped it to `true`. That added an "Expand code"
   * control the server HTML did not contain, and React discarded the whole
   * server-rendered page with error #418.
   *
   * `data-line-count` is published by the pipeline from the same tree that
   * produced the markup, so it gives the same answer on both sides. The
   * previous seed counted `<span class="line">` in the rendered HTML, which is a
   * Shiki convention: a block from any other engine measured one line, was
   * never expandable, and the control simply did not exist for it.
   */
  const seededIsExpandable =
    readLineCount(
      lineCount !== undefined ? { 'data-line-count': lineCount } : {},
      highlightedHtml,
      children,
    ) > maxLines
  const [isExpandable, setIsExpandable] = useState(seededIsExpandable)
  const preRef = useRef<HTMLElement | null>(null)

  const shouldTruncate = isExpandable && !isExpanded

  const toggle = () => setIsExpanded((prev) => !prev)

  // biome-ignore lint/correctness/useExhaustiveDependencies: updates when content changes
  useEffect(() => {
    const node = preRef.current
    if (!node) {
      setIsExpandable(false)
      return
    }

    const code = node.textContent ?? ''
    const lines = code.trim().split('\n').length
    const hasOverflow =
      'scrollHeight' in node &&
      'clientHeight' in node &&
      Number(node.scrollHeight) > Number(node.clientHeight)

    setIsExpandable(lines > maxLines || hasOverflow)
  }, [children, highlightedHtml, lineCount, maxLines])

  return {
    isExpanded,
    setIsExpanded,
    isExpandable,
    shouldTruncate,
    toggle,
    preRef,
  }
}
