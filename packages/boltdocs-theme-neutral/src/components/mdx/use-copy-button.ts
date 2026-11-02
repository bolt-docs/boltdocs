import { copyToClipboard } from '../../utils/copy-clipboard'
import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Copy-to-clipboard state for a code block (or any copyable surface).
 * `handleCopy(code)` copies the given text and shows a transient "copied"
 * confirmation for 2 seconds.
 */
export function useCopyButton() {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  const handleCopy = useCallback((code: string) => {
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

  return { copied, handleCopy }
}
