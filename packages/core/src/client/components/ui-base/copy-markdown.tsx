import { useState } from 'react'
import { Copy, Check, ExternalLink, ChevronDown } from 'lucide-react'
import { Button, ButtonGroup, Menu, cn } from '../../components/primitives'

import type { ComponentRoute } from '../../types'

export interface CopyMarkdownProps {
  content?: string
  mdxRaw?: string
  route?: ComponentRoute
  config?: boolean | { text?: string; icon?: string }
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

export function CopyMarkdown({ content, mdxRaw, config }: CopyMarkdownProps) {
  const displayContent = mdxRaw || content || ''
  const { copied, handleCopy, handleOpenRaw } = useCopyMarkdown(displayContent)

  const isEnabled = config !== false
  const buttonText =
    typeof config === 'object'
      ? config.text || 'Copy Markdown'
      : 'Copy Markdown'

  if (!isEnabled || !displayContent) return null

  return (
    <div className="relative hidden md:inline-flex z-100 shrink-0 w-max translate-y-0 active:translate-y-px transition-transform duration-200">
      <ButtonGroup className="rounded-xl border border-subtle bg-surface/40 backdrop-blur-md transition-all duration-300 hover:border-primary-500/50 group overflow-hidden">
        <Button
          variant="ghost"
          onPress={handleCopy}
          icon={copied ? <Check size={16} /> : <Copy size={16} />}
          iconPosition="left"
          className={cn(
            'px-5 py-2 bg-transparent text-[0.8125rem] font-semibold h-9 border-none shrink-0',
            'text-body transition-all duration-300 hover:bg-primary-500/5',
            copied && 'text-emerald-500 hover:bg-emerald-500/5',
          )}
        >
          {copied ? 'Copied!' : buttonText}
        </Button>

        <Menu.Trigger placement="bottom end">
          <Button
            variant="ghost"
            isIconOnly
            icon={<ChevronDown size={14} />}
            className={cn(
              'px-3.5 h-9 border-l border-subtle/50 text-muted rounded-none bg-transparent shrink-0',
              'transition-all duration-300 hover:bg-primary-500/5 hover:text-primary-500',
            )}
          />
          <Menu.Root className="w-52">
            <Menu.Item onAction={handleCopy}>
              <Copy
                size={16}
                className="size-4 mt-0.5 text-muted group-hover:text-primary-500"
              />
              <span className="font-medium text-[0.8125rem]">
                Copy Markdown
              </span>
            </Menu.Item>
            <Menu.Item onAction={handleOpenRaw}>
              <ExternalLink
                size={16}
                className="size-4 mt-0.5 text-muted group-hover:text-primary-500"
              />
              <span className="font-medium text-[0.8125rem]">
                View as Markdown
              </span>
            </Menu.Item>
          </Menu.Root>
        </Menu.Trigger>
      </ButtonGroup>
    </div>
  )
}
