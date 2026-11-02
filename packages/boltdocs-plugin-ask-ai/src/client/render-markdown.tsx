import { memo } from 'react'
import { Streamdown } from 'streamdown'

interface MarkdownRendererProps {
  content: string
  className?: string
  parseIncompleteMarkdown?: boolean
}

function MarkdownRendererImpl({
  content,
  className,
  parseIncompleteMarkdown = true,
}: MarkdownRendererProps) {
  if (!content) return null

  return (
    <div className={className}>
      <Streamdown parseIncompleteMarkdown={parseIncompleteMarkdown}>
        {content}
      </Streamdown>
    </div>
  )
}

/**
 * Memoized: while the message streams the same buffered content can be
 * re-rendered (e.g. a status flip reading → streaming) — this skips the
 * heavy markdown re-parse when nothing changed.
 */
export const MarkdownRenderer = memo(MarkdownRendererImpl)
