import { copyToClipboard } from '../../utils/copy-clipboard'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useConfig } from '../../app/config-context'
import { File } from '../ui-base/icons'
import {
  TypeScript,
  JavaScript,
  React as ReactIcon,
  Json,
  Css,
  BracketsOrange,
  Markdown,
  Shell,
  Yaml,
  Rust,
  BracketsRed,
  Csv,
} from '../icons-dev'
import type { CodeBlockProps } from './code-block'

const langIconMap: Record<string, React.ComponentType<{ size?: number }>> = {
  ts: TypeScript,
  tsx: ReactIcon,
  js: JavaScript,
  jsx: ReactIcon,
  json: Json,
  css: Css,
  html: BracketsOrange,
  md: Markdown,
  mdx: Markdown,
  bash: Shell,
  sh: Shell,
  yaml: Yaml,
  yml: Yaml,
  rs: Rust,
  rust: Rust,
  toml: BracketsRed,
  csv: Csv,
}

export function useCodeBlock(props: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isExpandable, setIsExpandable] = useState(false)
  const preRef = useRef<HTMLPreElement | HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [rated, setRated] = useState<'up' | 'down' | null>(null)
  const config = useConfig()
  const customConfig = config.integrations?.feedback?.custom
  const showCodeBlockFeedback = !!(customConfig?.enabled && !props.plain)

  const lang = props.lang || props['data-lang'] || ''
  const isHighlighted =
    props['data-highlighted'] === 'true' ||
    (typeof props.className === 'string' && props.className.includes('shiki'))

  const rawHighlightedHtml =
    props.highlightedHtml || props['data-highlighted-html']
  const effectiveHighlightedHtml =
    typeof rawHighlightedHtml === 'string'
      ? rawHighlightedHtml.replace(
          /<span class="line">\s*(?:<span[^>]*>\s*<\/span>)?\s*<\/span>\s*(<\/code>\s*<\/pre>)/g,
          '$1',
        )
      : rawHighlightedHtml
  const effectiveTitle = props.title || props['data-title']

  const handleRate = useCallback(
    async (type: 'up' | 'down') => {
      if (rated) return
      setRated(type)
      try {
        const code = preRef.current?.textContent ?? ''
        const snippet =
          code.trim().slice(0, 100) + (code.length > 100 ? '...' : '')
        const blockId = `Code Block (${lang || 'plain'}): \`${snippet}\``
        const endpoint = customConfig?.endpoint || '/api/feedback'

        await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            rating: type === 'up' ? 'good' : 'bad',
            comment: `Rated code block: ${type === 'up' ? 'Helpful' : 'Unhelpful'}`,
            path: window.location.pathname,
            title: document.title,
            blockId,
          }),
        })
      } catch (err) {
        console.error('Failed to submit code block feedback:', err)
      }
    },
    [rated, lang, customConfig?.endpoint],
  )

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

  const LangIcon = langIconMap[lang] || File

  return {
    copied,
    isExpanded,
    setIsExpanded,
    isExpandable,
    preRef,
    handleCopy,
    shouldTruncate: isExpandable && !isExpanded,
    isHighlighted,
    effectiveHighlightedHtml,
    effectiveTitle,
    lang,
    showCodeBlockFeedback,
    rated,
    handleRate,
    LangIcon,
  }
}
