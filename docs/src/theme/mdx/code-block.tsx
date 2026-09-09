import { Tooltip } from 'boltdocs/primitives'
import { Button } from '@/theme/button'
import { Copy, Check, ThumbsUp, ThumbsDown } from 'lucide-react'
import {
  cn,
  useCopyButton,
  useExpandable,
  useCodeBlockFeedback,
} from 'boltdocs/client'
import * as CodePrimitive from 'boltdocs/primitives'

export interface CodeBlockProps {
  children?: React.ReactNode
  className?: string
  hideCopy?: boolean
  title?: string
  lang?: string
  highlightedHtml?: string
  'data-lang'?: string
  'data-title'?: string
  'data-highlighted'?: string
  'data-highlighted-html'?: string
  plain?: boolean
  lineNumbers?: boolean | string
  showLineNumbers?: boolean | string
  wordWrap?: boolean | string
  'word-wrap'?: boolean | string
  metastring?: string
}

const CopyButton = ({
  copied,
  onCopy,
}: {
  copied: boolean
  onCopy: () => void
}) => {
  return (
    <Tooltip content={copied ? 'Copied!' : 'Copy code'}>
      <Button
        variant="ghost"
        size="icon"
        onPress={onCopy}
        className={cn(
          'grid place-items-center size-7 bg-transparent outline-none cursor-pointer transition-all duration-150 hover:scale-105 active:scale-95 z-10 rounded-md hover:bg-soft',
          copied ? 'text-success-500' : 'text-muted hover:text-body',
        )}
        aria-label="Copy code"
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </Button>
    </Tooltip>
  )
}

const CodeBlockFeedback = ({
  rated,
  onRate,
}: {
  rated: 'up' | 'down' | null
  onRate: (type: 'up' | 'down') => void
}) => {
  return (
    <div className="flex items-center gap-0.5 border-r border-subtle pr-1.5 mr-1">
      <Tooltip content={rated === 'up' ? 'Helpful!' : 'This code is helpful'}>
        <Button
          variant="ghost"
          size="icon"
          onPress={() => onRate('up')}
          isDisabled={rated !== null}
          className={cn(
            'grid place-items-center size-7 bg-transparent outline-none cursor-pointer transition-all duration-150 hover:scale-105 active:scale-95 z-10 rounded-md hover:bg-soft',
            rated === 'up'
              ? 'text-success-500'
              : rated === 'down'
                ? 'opacity-30 cursor-not-allowed text-muted'
                : 'text-muted hover:text-body',
          )}
          aria-label="Mark as helpful"
        >
          <ThumbsUp size={16} />
        </Button>
      </Tooltip>

      <Tooltip
        content={rated === 'down' ? 'Unhelpful' : 'This code is unhelpful'}
      >
        <Button
          variant="ghost"
          size="icon"
          onPress={() => onRate('down')}
          isDisabled={rated !== null}
          className={cn(
            'grid place-items-center size-7 bg-transparent outline-none cursor-pointer transition-all duration-150 hover:scale-105 active:scale-95 z-10 rounded-md hover:bg-soft',
            rated === 'down'
              ? 'text-error-500'
              : rated === 'up'
                ? 'opacity-30 cursor-not-allowed text-muted'
                : 'text-muted hover:text-body',
          )}
          aria-label="Mark as unhelpful"
        >
          <ThumbsDown size={16} />
        </Button>
      </Tooltip>
    </div>
  )
}

export function CodeBlock(props: CodeBlockProps) {
  const {
    children,
    hideCopy = false,
    highlightedHtml,
    'data-highlighted-html': dataHighlightedHtml,
    'data-highlighted': dataHighlighted,
    title,
    'data-title': dataTitle,
    lang: langProp,
    'data-lang': dataLang,
    plain = false,
    className: shikiClassName,
    lineNumbers,
    showLineNumbers,
    wordWrap,
    'word-wrap': wordWrapHyphen,
    metastring,
    ...rest
  } = props

  const lang = langProp || dataLang || ''
  const isHighlighted =
    dataHighlighted === 'true' ||
    (typeof shikiClassName === 'string' && shikiClassName.includes('shiki'))

  const rawHighlightedHtml = highlightedHtml || dataHighlightedHtml
  const effectiveHighlightedHtml =
    typeof rawHighlightedHtml === 'string'
      ? rawHighlightedHtml.replace(
          /<span class="line">\s*(?:<span[^>]*>\s*<\/span>)?\s*<\/span>\s*(<\/code>\s*<\/pre>)/g,
          '$1',
        )
      : rawHighlightedHtml
  const effectiveTitle = title || dataTitle

  const { copied, handleCopy } = useCopyButton()
  const { isExpanded, isExpandable, shouldTruncate, toggle, preRef } =
    useExpandable({
      children,
      highlightedHtml: effectiveHighlightedHtml,
    })
  const {
    rated,
    handleRate,
    enabled: showCodeBlockFeedback,
  } = useCodeBlockFeedback({ plain, lang })

  const onCopy = () => handleCopy(preRef.current?.textContent ?? '')
  const onRate = (type: 'up' | 'down') =>
    handleRate(type, preRef.current?.textContent ?? '')

  const showHeader = Boolean(effectiveTitle || lang || !hideCopy)
  const hasFloatingHeader = !effectiveTitle && !lang

  const preClassName = cn(
    effectiveHighlightedHtml
      ? '[&>pre>code]:text-[0.8125rem]! [&>pre>code]:leading-[1.7]!'
      : 'text-[0.8125rem] leading-[1.7]',
    '[&>code]:border-none!',
    isHighlighted && '[&>code]:pt-1!',
    'border-none!',
    shikiClassName,
  )

  return (
    <CodePrimitive.CodeBlock plain={plain} className={'border-none'}>
      {showHeader && (
        <CodePrimitive.CodeBlockHeader
          className={cn(
            'px-5',
            !hasFloatingHeader && 'relative h-10 bg-surface',
            hasFloatingHeader && 'absolute top-0 left-0 w-full',
          )}
        >
          <CodePrimitive.CodeBlockGroup className="min-w-0">
            {effectiveTitle ? (
              <span className="truncate text-[0.8125rem] font-medium text-muted">
                {effectiveTitle}
              </span>
            ) : lang ? (
              <span className="text-[0.6875rem] font-semibold tracking-wider text-dim">
                {lang}
              </span>
            ) : null}
          </CodePrimitive.CodeBlockGroup>
          {(showCodeBlockFeedback || !hideCopy) && (
            <CodePrimitive.CodeBlockActions className="bg-surface">
              {showCodeBlockFeedback && (
                <CodeBlockFeedback rated={rated} onRate={onRate} />
              )}
              {!hideCopy && <CopyButton copied={copied} onCopy={onCopy} />}
            </CodePrimitive.CodeBlockActions>
          )}
        </CodePrimitive.CodeBlockHeader>
      )}

      <CodePrimitive.CodeBlockContent
        className="border-none"
        shouldTruncate={shouldTruncate}
      >
        <CodePrimitive.CodeBlockPre
          ref={preRef}
          highlightedHtml={effectiveHighlightedHtml}
          isHighlighted={isHighlighted}
          className={preClassName}
          {...rest}
        >
          {children}
        </CodePrimitive.CodeBlockPre>

        <CodePrimitive.CodeBlockExpand
          isExpandable={isExpandable}
          shouldTruncate={shouldTruncate}
          isExpanded={isExpanded}
          onToggle={toggle}
          buttonClassName="rounded-lg px-4 py-1.5"
        />
      </CodePrimitive.CodeBlockContent>
    </CodePrimitive.CodeBlock>
  )
}
