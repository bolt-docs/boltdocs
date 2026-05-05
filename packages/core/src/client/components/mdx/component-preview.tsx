import { CodeBlock } from './code-block'
import { useComponentPreview } from './hooks/use-component-preview'

export interface ComponentPreviewProps {
  code?: string
  highlightedHtml?: string
  children?: string
  preview?: React.ReactNode
  hideCode?: boolean
  hideCopy?: boolean
}

export function ComponentPreview(props: ComponentPreviewProps) {
  const { highlightedHtml, hideCode = false, hideCopy = false } = props
  const { initialCode, previewElement } = useComponentPreview(props)

  return (
    <div className="my-6 overflow-hidden rounded-xl border border-subtle">
      <div className="flex items-center justify-center p-8 bg-surface">
        {previewElement}
      </div>

      {!hideCode && (
        <div className="border-t border-subtle">
          <CodeBlock
            hideCopy={hideCopy}
            lang="tsx"
            highlightedHtml={highlightedHtml}
            plain={true}
          >
            {initialCode}
          </CodeBlock>
        </div>
      )}
    </div>
  )
}
