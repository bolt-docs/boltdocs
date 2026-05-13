import { Button } from 'react-aria-components'
import { Copy, Check, File } from 'lucide-react'
import { cn } from '../../utils/cn'
import { reactToText } from '../../utils/react-to-text'
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
  plain?: boolean
  [key: string]: any
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
      {/* @ts-ignore */}
      <Button
        onPress={handleCopy}
        className={cn(
          'grid place-items-center size-8 bg-transparent outline-none cursor-pointer transition-all duration-200 hover:scale-110 active:scale-95 [&>svg]:size-4 [&>svg]:stroke-2 z-10',
          copied ? 'text-emerald-400' : 'text-muted hover:text-body',
        )}
        aria-label="Copy code"
      >
        {/* @ts-ignore */}
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
    ...rest
  } = props

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
            // @ts-expect-error
            ref={preRef}
            className="shiki-wrapper overflow-x-auto [&>pre]:m-0! [&>pre]:rounded-none! [&>pre]:border-none! [&>pre]:bg-inherit! [&>pre>code]:grid! [&>pre>code]:p-5! [&>pre>code]:text-[0.875rem]! [&>pre>code]:leading-[1.6]! [&>.shiki.shiki-themes]:bg-transparent!"
            dangerouslySetInnerHTML={{ __html: effectiveHighlightedHtml }}
          />
        ) : (
          <pre
            ref={preRef}
            className="m-0! p-5! rounded-none! border-none! bg-inherit! font-mono text-[0.875rem] leading-[1.6] overflow-x-auto"
            {...rest}
          >
            {reactToText(children).trimEnd()}
          </pre>
        )}

        {/* Expand/Collapse Trigger */}
        {isExpandable && (
          <div
            className={cn(
              shouldTruncate
                ? 'absolute bottom-0 inset-x-0 h-24 bg-linear-to-t from-(--color-code-bg) to-transparent flex items-end justify-center pb-4 z-10'
                : 'relative flex justify-center pb-4 pt-1 -mt-4',
            )}
          >
            {/* @ts-ignore */}
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
