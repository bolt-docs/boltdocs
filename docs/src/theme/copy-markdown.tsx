import { useState, useEffect, useRef } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/theme/button'
import { cn } from 'boltdocs/client'
import type { ComponentRoute } from 'boltdocs/client'

export interface CopyMarkdownProps {
  content?: string
  mdxRaw?: string
  route?: ComponentRoute
  className?: string
}

const useCopyMarkdown = (content: string) => {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    timerRef.current = setTimeout(() => {
      setCopied(false)
      timerRef.current = null
    }, 2000)
  }

  return {
    copied,
    handleCopy,
  }
}

export function CopyMarkdown({
  content,
  mdxRaw,
  className,
}: CopyMarkdownProps) {
  const displayContent = mdxRaw || content || ''
  const { copied, handleCopy } = useCopyMarkdown(displayContent)

  if (!displayContent) return null

  return (
    <div className={cn('mt-2', className)}>
      <Button
        variant="ghost"
        size="md"
        onPress={handleCopy}
        className={cn(
          'flex items-center gap-1 px-3 py-2 rounded-md text-xs font-semibold outline-none select-none cursor-pointer border-none',
          'text-main transition-all duration-150',
          !copied && 'hover:bg-body hover:opacity-90 bg-body',
          copied && 'text-success-600 hover:bg-success-500/10',
        )}
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
        {copied ? 'Copied!' : 'Copy Page'}
      </Button>
    </div>
  )
}
