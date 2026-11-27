import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/theme/button'
import { cn, useCopyMarkdown } from '@bdocs/theme-neutral'
import type { ComponentRoute } from '@bdocs/runtime'
import { getPageSourceFetcher } from '@bdocs/runtime'

export interface CopyMarkdownProps {
  content?: string
  mdxRaw?: string
  route?: ComponentRoute
  className?: string
}

// One fetch per session: every docs page renders a CopyMarkdown button.
let pageSourcePromise: Promise<Record<string, string>> | null = null
function getPageSource(): Promise<Record<string, string>> {
  const pending = pageSourcePromise
  if (pending) return pending
  const fetched = getPageSourceFetcher()().catch(() => ({}))
  pageSourcePromise = fetched
  return fetched
}

export function CopyMarkdown({
  content,
  mdxRaw,
  route,
  className,
}: CopyMarkdownProps) {
  const routePath = route?.path
  const [rawState, setRawState] = useState<{
    path: string
    value?: string
    resolved: boolean
  }>({ path: '', resolved: false })
  const current =
    rawState.path === routePath && routePath
      ? rawState
      : { path: routePath || '', resolved: false, value: undefined }

  useEffect(() => {
    if (mdxRaw || content || !routePath) return
    let cancelled = false
    getPageSource().then((record) => {
      if (!cancelled) {
        setRawState({
          path: routePath,
          value: record[routePath],
          resolved: true,
        })
      }
    })
    return () => {
      cancelled = true
    }
  }, [routePath, mdxRaw, content])

  const displayContent = mdxRaw || current.value || content || ''
  const { copied, handleCopy } = useCopyMarkdown(displayContent)

  // Hide only when there is provably nothing to copy. While the page source
  // lookup is pending, render optimistically so the button doesn't flash.
  const nothingToCopy =
    !displayContent && (!!content || !!mdxRaw || current.resolved || !routePath)
  if (nothingToCopy) return null

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
