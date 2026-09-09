import { Button } from 'react-aria-components'
import { Copy, Check } from '../ui-base/icons'
import { cn } from '../../utils/cn'
import { useCopyButton } from './use-copy-button'
import { useExpandable } from './use-expandable'
import { useCodeBlockFeedback } from './use-code-block-feedback'
import * as CodePrimitive from '../primitives/code-block'
import { Tooltip } from '../primitives/tooltip'

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
  feedbackClassName?: string
  copyButtonClassName?: string
}

const CopyButton = ({
  copied,
  onCopy,
  className,
}: {
  copied: boolean
  onCopy: () => void
  className?: string
}) => {
  return (
    <Tooltip content={copied ? 'Copied!' : 'Copy code'}>
      <Button
        onPress={onCopy}
        className={cn(
          'grid place-items-center size-8 bg-transparent outline-none cursor-pointer transition-all duration-200 hover:scale-110 active:scale-95 [&>svg]:size-4 [&>svg]:stroke-2 z-10',
          copied ? 'text-emerald-400' : 'text-muted hover:text-body',
          className,
        )}
        aria-label="Copy code"
      >
        {copied ? <Check size={20} /> : <Copy size={20} />}
      </Button>
    </Tooltip>
  )
}

const CodeBlockFeedback = ({
  rated,
  onRate,
  className,
}: {
  rated: 'up' | 'down' | null
  onRate: (type: 'up' | 'down') => void
  className?: string
}) => {
  return (
    <div
      className={cn(
        'flex items-center gap-0.5 border-r border-subtle pr-1.5 mr-1',
        className,
      )}
    >
      <Tooltip content={rated === 'up' ? 'Helpful!' : 'This code is helpful'}>
        <Button
          onPress={() => onRate('up')}
          isDisabled={rated !== null}
          className={cn(
            'grid place-items-center size-8 bg-transparent outline-none cursor-pointer transition-all duration-200 hover:scale-110 active:scale-95 [&>svg]:size-4 [&>svg]:stroke-2 z-10',
            rated === 'up'
              ? 'text-emerald-500 dark:text-emerald-400'
              : rated === 'down'
                ? 'opacity-30 cursor-not-allowed text-muted'
                : 'text-muted hover:text-body',
          )}
          aria-label="Mark as helpful"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="Thumb up"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
          </svg>
        </Button>
      </Tooltip>

      <Tooltip
        content={rated === 'down' ? 'Unhelpful' : 'This code is unhelpful'}
      >
        <Button
          onPress={() => onRate('down')}
          isDisabled={rated !== null}
          className={cn(
            'grid place-items-center size-8 bg-transparent outline-none cursor-pointer transition-all duration-200 hover:scale-110 active:scale-95 [&>svg]:size-4 [&>svg]:stroke-2 z-10',
            rated === 'down'
              ? 'text-rose-500 dark:text-rose-400'
              : rated === 'up'
                ? 'opacity-30 cursor-not-allowed text-muted'
                : 'text-muted hover:text-body',
          )}
          aria-label="Mark as unhelpful"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="Thumb down"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" />
          </svg>
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
    feedbackClassName,
    copyButtonClassName,
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

  return (
    <CodePrimitive.CodeBlock plain={plain} className={shikiClassName}>
      {(effectiveTitle || !hideCopy) && (
        <CodePrimitive.CodeBlockHeader
          className={cn({
            'absolute top-2 left-0 w-full': !effectiveTitle,
          })}
        >
          <CodePrimitive.CodeBlockGroup>
            {effectiveTitle && <span>{effectiveTitle}</span>}
          </CodePrimitive.CodeBlockGroup>
          {(showCodeBlockFeedback || !hideCopy) && (
            <CodePrimitive.CodeBlockActions>
              {showCodeBlockFeedback && (
                <CodeBlockFeedback
                  rated={rated}
                  onRate={onRate}
                  className={feedbackClassName}
                />
              )}
              {!hideCopy && (
                <CopyButton
                  copied={copied}
                  onCopy={onCopy}
                  className={copyButtonClassName}
                />
              )}
            </CodePrimitive.CodeBlockActions>
          )}
        </CodePrimitive.CodeBlockHeader>
      )}

      <CodePrimitive.CodeBlockContent shouldTruncate={shouldTruncate}>
        <CodePrimitive.CodeBlockPre
          ref={preRef}
          highlightedHtml={effectiveHighlightedHtml}
          isHighlighted={isHighlighted}
          className={shikiClassName}
          {...rest}
        >
          {children}
        </CodePrimitive.CodeBlockPre>

        <CodePrimitive.CodeBlockExpand
          isExpandable={isExpandable}
          shouldTruncate={shouldTruncate}
          isExpanded={isExpanded}
          onToggle={toggle}
        />
      </CodePrimitive.CodeBlockContent>
    </CodePrimitive.CodeBlock>
  )
}
