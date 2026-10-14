import { useCopyButton } from './use-copy-button'
import { useExpandable } from './use-expandable'
import { useCodeBlockFeedback } from './use-code-block-feedback'
import type { CodeBlockProps } from './code-block'
import {
  cleanHighlightedHtml,
  isHighlighted as stateIsHighlighted,
  readCodeBlockState,
} from './code-state'

/**
 * @deprecated Use the feature-scoped hooks instead: `useCopyButton`,
 * `useExpandable` and `useCodeBlockFeedback`. This composition keeps the
 * historical single-hook API and will be removed in a future major version.
 */
export function useCodeBlock(props: CodeBlockProps) {
  const lang = props.lang || props['data-lang'] || ''
  // Same reader as `CodeBlock` — the deprecated hook guessed from the class
  // name, and the two copies of that guess had already begun to disagree.
  const isHighlighted = stateIsHighlighted(readCodeBlockState(props))

  const rawHighlightedHtml =
    props.highlightedHtml || props['data-highlighted-html']
  const effectiveHighlightedHtml =
    typeof rawHighlightedHtml === 'string'
      ? cleanHighlightedHtml(rawHighlightedHtml)
      : rawHighlightedHtml
  const effectiveTitle = props.title || props['data-title']

  const { copied, handleCopy } = useCopyButton()
  const { isExpanded, setIsExpanded, isExpandable, shouldTruncate, preRef } =
    useExpandable({
      children: props.children,
      highlightedHtml: effectiveHighlightedHtml,
    })
  const {
    rated,
    handleRate,
    enabled: showCodeBlockFeedback,
  } = useCodeBlockFeedback({ plain: props.plain, lang })

  const copyFromRef = () => handleCopy(preRef.current?.textContent ?? '')
  const rateFromRef = (type: 'up' | 'down') =>
    handleRate(type, preRef.current?.textContent ?? '')

  return {
    copied,
    isExpanded,
    setIsExpanded,
    isExpandable,
    preRef,
    handleCopy: copyFromRef,
    shouldTruncate,
    isHighlighted,
    effectiveHighlightedHtml,
    effectiveTitle,
    lang,
    showCodeBlockFeedback,
    rated,
    handleRate: rateFromRef,
  }
}
