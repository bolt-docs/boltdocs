import { Streamdown } from 'streamdown'

interface MarkdownRendererProps {
  content: string
  className?: string
  parseIncompleteMarkdown?: boolean
}

export function MarkdownRenderer({
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
