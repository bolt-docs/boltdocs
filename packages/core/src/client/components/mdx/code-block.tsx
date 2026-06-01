import { Button } from 'react-aria-components'
import { Copy, Check, File } from '../ui-base/icons'
import { cn } from '../../utils/cn'
import { useCodeBlock } from './use-code-block'
import * as CodePrimitive from '../primitives/code-block'
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
import { Tooltip } from '../primitives/tooltip'

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
    // Extract non-standard DOM properties passed by the MDX compiler/plugins
    lineNumbers,
    showLineNumbers,
    wordWrap,
    'word-wrap': wordWrapHyphen,
    metastring,
    ...rest
  } = props

  const { className: shikiClassName, ...cleanRest } = rest
  const isHighlighted =
    props['data-highlighted'] === 'true' ||
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
  const lang = props.lang || dataLang || ''

  const {
    copied,
    isExpanded,
    setIsExpanded,
    isExpandable,
    preRef,
    handleCopy,
    shouldTruncate,
  } = useCodeBlock(props)

  const LangIcon = langIconMap[lang]

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
