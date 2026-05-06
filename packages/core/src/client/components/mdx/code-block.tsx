import { Button } from 'react-aria-components'
import { Copy, Check, File, ExternalLink } from 'lucide-react'
import { cn } from '../../utils/cn'
import { reactToText } from '../../utils/react-to-text'
import { useCodeBlock } from './hooks/use-code-block'
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
  csv: Csv
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
          'grid place-items-center size-8 bg-transparent outline-none cursor-pointer transition-all duration-200 hover:scale-110 active:scale-95 [&>svg]:size-4 [&>svg]:stroke-2',
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

  const effectiveHighlightedHtml = highlightedHtml || dataHighlightedHtml
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

  const codeText = reactToText(children)
  const LangIcon = langIconMap[lang]

  return (
    <CodePrimitive.CodeBlock plain={plain} className={props.className}>
      {(effectiveTitle || !hideCopy) && (
        <CodePrimitive.CodeBlockHeader>
          <CodePrimitive.CodeBlockGroup>
            {effectiveTitle && (
              <>
                {LangIcon ? (
                  <LangIcon size={14} />
                ) : (
                  // @ts-expect-error
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
            className="shiki-wrapper [&>pre]:m-0! [&>pre]:rounded-none! [&>pre]:border-none! [&>pre]:bg-inherit! [&>pre>code]:grid! [&>pre>code]:p-5! [&>pre>code]:text-[0.875rem]! [&>pre>code]:leading-[1.6]! [&>.shiki.shiki-themes]:bg-transparent!"
            dangerouslySetInnerHTML={{ __html: effectiveHighlightedHtml }}
          />
        ) : (
          <pre
            ref={preRef}
            className="m-0! p-5! rounded-none! border-none! bg-inherit! font-mono text-[0.875rem] leading-[1.6] overflow-x-auto"
            {...rest}
          >
            {reactToText(children)}
          </pre>
        )}

        {/* Expand/Collapse Trigger */}
        {isExpandable && (
          <div
            className={cn(
              shouldTruncate
                ? 'absolute bottom-0 inset-x-0 h-24 bg-linear-to-t from-(--color-code-bg) to-transparent flex items-end justify-center pb-4 z-10'
                : 'relative flex justify-center py-4',
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
