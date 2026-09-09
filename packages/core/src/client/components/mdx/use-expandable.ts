import { useEffect, useRef, useState } from 'react'

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
  const [isExpandable, setIsExpandable] = useState(false)
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
