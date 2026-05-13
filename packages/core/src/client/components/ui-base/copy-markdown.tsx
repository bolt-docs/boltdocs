import { useState } from 'react'
import { Copy, Check, ExternalLink, ChevronDown } from 'lucide-react'
import { Button } from '../primitives/button'
import { ButtonGroup } from '../primitives/button-group'
import { Menu } from '../primitives/menu'
import { cn } from '../../utils/cn'
import type { ComponentRoute } from '../../types'

export interface CopyMarkdownProps {
  content?: string
  mdxRaw?: string
  route?: ComponentRoute
}

const useCopyMarkdown = (content: string) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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

export function CopyMarkdown({ content, mdxRaw }: CopyMarkdownProps) {
  const displayContent = mdxRaw || content || ''
  const { copied, handleCopy, handleOpenRaw } = useCopyMarkdown(displayContent)

  if (!displayContent) return null

  return (
    <div className="relative inline-flex z-100 shrink-0 w-max">
      <ButtonGroup className="rounded-xl border border-subtle bg-surface transition-all duration-300 hover:border-primary-500/50 group overflow-hidden">
        {/* Mobile: icon-only copy button */}
        <Button
          onPress={handleCopy}
          className={cn(
            'md:hidden flex items-center justify-center w-8 h-8 bg-transparent outline-none select-none cursor-pointer border-none',
            'text-muted transition-all duration-300 hover:bg-primary-500/5 hover:text-body',
            copied && 'text-emerald-500 hover:bg-emerald-500/5',
          )}
          aria-label={copied ? 'Copied!' : 'Copy Markdown'}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </Button>

        {/* Desktop: full copy button with label */}
        <Button
          onPress={handleCopy}
          className={cn(
            'hidden md:flex items-center gap-2 px-5 py-2 bg-transparent text-[0.8125rem] font-semibold h-9 shrink-0 outline-none select-none cursor-pointer border-none',
            'text-body transition-all duration-300 hover:bg-primary-500/5',
            copied && 'text-emerald-500 hover:bg-emerald-500/5',
          )}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'Copied!' : 'Copy Markdown'}
        </Button>

        <Menu.Trigger placement="bottom end">
          <Button
            className={cn(
              'flex items-center justify-center px-2.5 md:px-3.5 h-8 md:h-9 border-none border-l border-subtle/50 text-muted rounded-none bg-transparent shrink-0 outline-none select-none cursor-pointer',
              'transition-all duration-300 hover:bg-primary-500/5 hover:text-primary-500',
            )}
          >
            <ChevronDown size={14} />
          </Button>
          <Menu.Root className="w-52 bg-main border border-subtle rounded-xl p-1.5 shadow-md outline-none flex flex-col gap-0.5 animate-fade-in z-100">
            <Menu.Item
              onAction={handleCopy}
              className="flex items-center px-3 py-2 rounded-lg text-xs font-medium text-body dark:hover:bg-primary-300/50 hover:bg-primary-200/50 transition-colors duration-100 cursor-pointer select-none outline-none group"
            >
              <Copy
                size={16}
                className="size-4 text-muted dark:group-hover:text-primary-500 group-hover:text-primary-400"
              />
              <span className="ml-2">Copy Markdown</span>
            </Menu.Item>
            <Menu.Item
              onAction={handleOpenRaw}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-body dark:hover:bg-primary-300/50 hover:bg-primary-200/50 transition-colors duration-100 cursor-pointer select-none outline-none group"
            >
              <ExternalLink
                size={16}
                className="size-4 text-muted dark:group-hover:text-primary-500 group-hover:text-primary-400"
              />
              <span className="ml-2">View as Markdown</span>
            </Menu.Item>
          </Menu.Root>
        </Menu.Trigger>
      </ButtonGroup>
    </div>
  )
}
