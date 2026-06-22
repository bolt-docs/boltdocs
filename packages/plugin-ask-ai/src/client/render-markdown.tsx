import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownRendererProps {
  content: string
  className?: string
}

export function MarkdownRenderer({
  content,
  className,
}: MarkdownRendererProps) {
  if (!content) return null

  return (
    <div className={className}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className: codeClassName, children, ...props }) {
            const match = /language-(\w+)/.exec(codeClassName || '')
            const isBlock = String(children).includes('\n')

            if (isBlock) {
              return (
                <pre className="p-3 my-2 overflow-x-auto rounded-lg bg-surface border border-subtle text-xs font-mono text-body">
                  {match && (
                    <div className="text-[10px] text-muted uppercase font-bold tracking-widest mb-1.5 border-b border-subtle pb-1">
                      {match[1]}
                    </div>
                  )}
                  <code className={codeClassName} {...props}>
                    {children}
                  </code>
                </pre>
              )
            }

            return (
              <code
                className="px-1.5 py-0.5 rounded-md bg-surface border border-subtle text-xs font-mono text-primary-500"
                {...props}
              >
                {children}
              </code>
            )
          },
          p({ children }) {
            return (
              <p className="mb-2 text-sm text-body/90 leading-relaxed last:mb-0">
                {children}
              </p>
            )
          },
          ul({ children }) {
            return (
              <ul className="mb-2 ml-4 list-disc text-sm text-body/90 space-y-1">
                {children}
              </ul>
            )
          },
          ol({ children }) {
            return (
              <ol className="mb-2 ml-4 list-decimal text-sm text-body/90 space-y-1">
                {children}
              </ol>
            )
          },
          li({ children }) {
            return <li className="leading-relaxed">{children}</li>
          },
          strong({ children }) {
            return (
              <strong className="font-semibold text-body">{children}</strong>
            )
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                className="text-primary-500 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            )
          },
          h1({ children }) {
            return (
              <h1 className="text-lg font-bold text-body mb-2 mt-4">
                {children}
              </h1>
            )
          },
          h2({ children }) {
            return (
              <h2 className="text-base font-bold text-body mb-2 mt-3">
                {children}
              </h2>
            )
          },
          h3({ children }) {
            return (
              <h3 className="text-sm font-bold text-body mb-1 mt-2">
                {children}
              </h3>
            )
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-2 border-primary-500 pl-3 my-2 text-sm text-muted italic">
                {children}
              </blockquote>
            )
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-2">
                <table className="text-xs text-body/90 border-collapse">
                  {children}
                </table>
              </div>
            )
          },
          th({ children }) {
            return (
              <th className="px-2 py-1 border border-subtle bg-surface text-left font-semibold">
                {children}
              </th>
            )
          },
          td({ children }) {
            return (
              <td className="px-2 py-1 border border-subtle">{children}</td>
            )
          },
          hr() {
            return <hr className="my-3 border-subtle" />
          },
        }}
      >
        {content}
      </Markdown>
    </div>
  )
}
