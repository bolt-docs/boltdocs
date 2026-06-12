import { Button } from 'react-aria-components'
import { Copy, Check, File } from '../ui-base/icons'
import { cn } from '../../utils/cn'
import { useCodeBlock } from './use-code-block'
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
}

const CopyButton = ({
  copied,
  handleCopy,
}: {
  copied: boolean
  handleCopy: () => void
}) => {
  return (
    <Tooltip content={copied ? 'Copied!' : 'Copy code'}>
      <Button
        onPress={handleCopy}
        className={cn(
          'grid place-items-center size-8 bg-transparent outline-none cursor-pointer transition-all duration-200 hover:scale-110 active:scale-95 [&>svg]:size-4 [&>svg]:stroke-2 z-10',
          copied ? 'text-emerald-400' : 'text-muted hover:text-body',
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
}: {
  rated: 'up' | 'down' | null
  onRate: (type: 'up' | 'down') => void
}) => {
  return (
    <div className="flex items-center gap-0.5 border-r border-subtle pr-1.5 mr-1">
      <Tooltip content={rated === 'up' ? 'Helpful!' : 'This code is helpful'}>
        <Button
          onPress={() => onRate('up')}
          disabled={rated !== null}
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
          disabled={rated !== null}
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
    title,
    'data-title': dataTitle,
    'data-lang': dataLang,
    plain = false,
    lineNumbers,
    showLineNumbers,
    wordWrap,
    'word-wrap': wordWrapHyphen,
    metastring,
    ...rest
  } = props

  const { className: shikiClassName, ...cleanRest } = rest

  const {
    copied,
    isExpanded,
    setIsExpanded,
    isExpandable,
    preRef,
    handleCopy,
    shouldTruncate,
    isHighlighted,
    effectiveHighlightedHtml,
    effectiveTitle,
    showCodeBlockFeedback,
    rated,
    handleRate,
    LangIcon,
  } = useCodeBlock(props)

  return (
    <CodePrimitive.CodeBlock plain={plain} className={props.className}>
      {(effectiveTitle || !hideCopy) && (
        <CodePrimitive.CodeBlockHeader
          className={cn({
            'absolute top-2 left-0 w-full': !effectiveTitle,
          })}
        >
          <CodePrimitive.CodeBlockGroup>
            {effectiveTitle && (
              <>
                {LangIcon ? (
                  <LangIcon size={14} />
                ) : (
                  <File size={14} className="opacity-60" />
                )}
                <span>{effectiveTitle}</span>
              </>
            )}
          </CodePrimitive.CodeBlockGroup>
          <div className="flex items-center gap-1">
            {showCodeBlockFeedback && (
              <CodeBlockFeedback rated={rated} onRate={handleRate} />
            )}
            {!hideCopy && (
              <CopyButton copied={copied} handleCopy={handleCopy} />
            )}
          </div>
        </CodePrimitive.CodeBlockHeader>
      )}

      <CodePrimitive.CodeBlockContent shouldTruncate={shouldTruncate}>
        {effectiveHighlightedHtml ? (
          <div
            ref={preRef}
            className="shiki-wrapper overflow-x-auto [&>pre]:m-0! [&>pre]:rounded-none! [&>pre]:border-none! [&>pre]:bg-inherit! [&>pre>code]:grid! [&>pre>code]:p-5! [&>pre>code]:text-[0.875rem]! [&>pre>code]:leading-[1.6]! [&>.shiki.shiki-themes]:bg-transparent!"
            dangerouslySetInnerHTML={{ __html: effectiveHighlightedHtml }}
          />
        ) : (
          <pre
            ref={preRef}
            className={cn(
              'm-0! rounded-none! border-none! bg-transparent!',
              'text-[0.875rem] leading-[1.6] overflow-x-auto',
              shikiClassName,
              {
                'p-0! [&>code]:grid! [&>code]:p-5! [&>code]:bg-transparent!':
                  isHighlighted,
                'p-5!': !isHighlighted,
              },
            )}
            {...cleanRest}
          >
            {children}
          </pre>
        )}

        {isExpandable && (
          <div
            className={cn({
              'absolute bottom-0 inset-x-0 h-32 flex items-end justify-center pb-4 z-10':
                shouldTruncate,
              'relative flex justify-center pb-4 pt-1 -mt-4': !shouldTruncate,
            })}
            style={
              shouldTruncate
                ? {
                    backgroundImage:
                      'linear-gradient(to top, var(--color-code-bg) 10%, transparent)',
                  }
                : undefined
            }
          >
            <Button
              onPress={() => setIsExpanded(!isExpanded)}
              className="rounded-full bg-surface border border-subtle px-5 py-2 text-[0.8125rem] font-medium text-body outline-none cursor-pointer transition-all hover:bg-soft hover:-translate-y-px backdrop-blur-md"
            >
              {isExpanded ? 'Show less' : 'Expand code'}
            </Button>
          </div>
        )}
      </CodePrimitive.CodeBlockContent>
    </CodePrimitive.CodeBlock>
  )
}
