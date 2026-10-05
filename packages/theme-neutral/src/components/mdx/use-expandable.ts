import { useEffect, useRef, useState } from 'react'

/**
 * Counts the rendered lines of a pre-rendered Shiki block.
 *
 * `data-highlighted-html` holds the same markup the server writes, so the count
 * is available before the DOM exists. Returns 0 when there is no HTML, which
 * leaves the caller on the DOM-measured path.
 */
function countHighlightedLines(highlightedHtml?: string): number {
  if (!highlightedHtml) return 0
  const spans = highlightedHtml.split('<span class="line"').length - 1
  return spans > 0 ? spans : highlightedHtml.split('\n').length
}

export interface UseExpandableOptions {
  /** The raw children rendered inside the code area (for line counting). */
  children?: React.ReactNode
  /** Pre-rendered Shiki HTML when available (for line counting). */
  highlightedHtml?: string
  /** Number of lines above which the block becomes expandable. @default 6 */
  maxLines?: number
}

/**
 * Expand / collapse behavior for long code blocks. Measures the rendered code
 * through `preRef` and exposes whether the block is expandable, whether it
 * should be visually truncated, and a toggle handler.
 */
export function useExpandable(options: UseExpandableOptions = {}) {
  const { children, highlightedHtml, maxLines = 6 } = options
  const [isExpanded, setIsExpanded] = useState(false)

  /**
   * Seed the expandable state from the pre-rendered HTML when it is available.
   *
   * The block measures itself against the live DOM, which does not exist during
   * server rendering, so the flag started as `false` on both sides and the
   * client's `useEffect` then flipped it to `true`. That added an "Expand code"
   * control the server HTML did not contain, and React discarded the whole
   * server-rendered page with error #418.
   *
   * Counting newlines in `data-highlighted-html` gives the same answer on both
   * sides, so the first client render already matches. The effect below stays
   * as the authority once layout is known, because a block can also be
   * truncated by overflow rather than by line count.
   */
  const seededIsExpandable = countHighlightedLines(highlightedHtml) > maxLines
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
  }, [children, highlightedHtml, maxLines])

  return {
    isExpanded,
    setIsExpanded,
    isExpandable,
    shouldTruncate,
    toggle,
    preRef,
  }
}
