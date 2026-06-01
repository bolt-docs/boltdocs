import { copyToClipboard } from '../../utils/copy-clipboard'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CodeBlockProps } from './code-block'

export function useCodeBlock(props: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isExpandable, setIsExpandable] = useState(false)
  const preRef = useRef<HTMLPreElement | HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  const handleCopy = useCallback(async () => {
    const code = preRef.current?.textContent ?? ''
    copyToClipboard(code)
    setCopied(true)
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    timerRef.current = setTimeout(() => {
      setCopied(false)
      timerRef.current = null
    }, 2000)
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: updates when content changes
  useEffect(() => {
    const code = preRef.current?.textContent ?? ''
    const lines = code.trim().split('\n').length
    setIsExpandable(lines > 6)
  }, [props.children, props.highlightedHtml])

  return {
    copied,
    isExpanded,
    setIsExpanded,
    isExpandable,
    preRef,
    handleCopy,
    shouldTruncate: isExpandable && !isExpanded,
  }
}
