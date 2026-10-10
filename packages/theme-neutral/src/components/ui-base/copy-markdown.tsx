import { useState, useEffect, useRef } from 'react'
import { Copy, Check, ExternalLink, ChevronDown } from './icons'
import { Button } from '../composition/button'
import { ButtonGroup } from '../composition/button-group'
import { Menu } from '../composition/menu'
import { cn } from '../../utils/cn'
import type { ComponentRoute } from '@bdocs/runtime'
import { getPageSourceFetcher } from '@bdocs/runtime'

export interface CopyMarkdownProps {
  content?: string
  /**
   * Explicit raw markdown override. When omitted, the raw source is fetched
   * lazily from the page-source.json asset (keyed by route path) instead of
   * being embedded in the shared client bundle.
   */
  mdxRaw?: string
  route?: ComponentRoute
  className?: string
}

// One fetch per session: every docs page renders a CopyMarkdown button, so
// the asset is fetched once on the first docs page and reused afterwards.
let pageSourcePromise: Promise<Record<string, string>> | null = null
function getPageSource(): Promise<Record<string, string>> {
  if (!pageSourcePromise) {
    pageSourcePromise = getPageSourceFetcher()().catch(() => ({}))
  }
  return pageSourcePromise
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

  const handleOpenRaw = () => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
  }

  return {
    copied,
    handleCopy,
    handleOpenRaw,
  }
}

export function CopyMarkdown({
  content,
  mdxRaw,
  route,
  className,
}: CopyMarkdownProps) {
  const routePath = route?.path
  // State is keyed by route path: on SPA navigation the derived `current`
  // resets immediately (no stale copy of the previous page), and the fetch
  // result is stored under its own path so it can never leak across routes.
  const [rawState, setRawState] = useState<{
    path: string
    value?: string
    resolved: boolean
  }>({ path: '', resolved: false })
  const current =
    rawState.path === routePath && routePath
      ? rawState
      : { path: routePath || '', resolved: false }

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
  const { copied, handleCopy, handleOpenRaw } = useCopyMarkdown(displayContent)

  // Hide when there is provably nothing to copy: explicit empty content, or
  // the page-source lookup resolved without an entry (synthetic routes).
  // While the lookup is still pending on a docs route, render optimistically
  // so the button doesn't flash out of the layout after hydration.
  const nothingToCopy =
    !displayContent && (!!content || !!mdxRaw || current.resolved || !routePath)
  if (nothingToCopy) return null

  return (
    <div className={cn('bdocs-copy-markdown', className)}>
      <ButtonGroup className="bdocs-copy-markdown__group">
        {/* Mobile: icon-only copy button */}
        <Button
          onPress={handleCopy}
          className={cn(
            'bdocs-copy-markdown__button bdocs-copy-markdown__button--icon',
            copied && 'bdocs-copy-markdown__button--copied',
          )}
          aria-label={copied ? 'Copied!' : 'Copy Markdown'}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </Button>

        {/* Desktop: full copy button with label */}
        <Button
          onPress={handleCopy}
          className={cn(
            'bdocs-copy-markdown__button bdocs-copy-markdown__button--label',
            copied && 'bdocs-copy-markdown__button--copied',
          )}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'Copied!' : 'Copy Markdown'}
        </Button>

        <Menu.Trigger className="bdocs-copy-markdown__menu-trigger">
          <Button className="bdocs-copy-markdown__menu-button">
            <ChevronDown size={14} />
          </Button>
          <Menu.Root className="bdocs-copy-markdown__menu">
            <Menu.Item
              onAction={handleCopy}
              className="bdocs-copy-markdown__menu-item"
            >
              <Copy size={16} className="bdocs-copy-markdown__menu-icon" />
              <span className="bdocs-copy-markdown__menu-label">
                Copy Markdown
              </span>
            </Menu.Item>
            <Menu.Item
              onAction={handleOpenRaw}
              className="bdocs-copy-markdown__menu-item"
            >
              <ExternalLink
                size={16}
                className="bdocs-copy-markdown__menu-icon"
              />
              <span className="bdocs-copy-markdown__menu-label">
                View as Markdown
              </span>
            </Menu.Item>
          </Menu.Root>
        </Menu.Trigger>
      </ButtonGroup>
    </div>
  )
}
