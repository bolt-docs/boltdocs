import { visit } from 'unist-util-visit'
import type { BoltdocsConfig } from '../config'
import { ShikiAdapter } from './shiki-adapter'

/**
 * Custom remark plugin to highlight code in ComponentPreview components.
 */
export function remarkShiki(config?: BoltdocsConfig) {
  const adapter = new ShikiAdapter(config)

  return async (tree: any) => {
    const highlighter = await adapter.getHighlighter()

    visit(tree, ['mdxJsxFlowElement', 'mdxJsxTextElement'], (node: any) => {
      if (node.name !== 'ComponentPreview') return

      const codeAttr = node.attributes?.find((a: any) => a.name === 'code')
      let code = ''

      if (codeAttr) {
        if (typeof codeAttr.value === 'string') {
          code = codeAttr.value
        } else if (codeAttr.value?.type === 'mdxJsxAttributeValueExpression') {
          const expr = codeAttr.value.value ?? ''
          code = expr.match(/^[`'"]([\s\S]+)[`'"]$/)?.[1] ?? expr
        }
      }

      if (!code) return

      // Extract props that should act as meta
      const lineNumbersAttr = node.attributes?.find(
        (a: any) => a.name === 'lineNumbers' || a.name === 'showLineNumbers',
      )
      const wordWrapAttr = node.attributes?.find(
        (a: any) => a.name === 'wordWrap' || a.name === 'word-wrap',
      )
      const titleAttr = node.attributes?.find((a: any) => a.name === 'title')

      // Build a fake raw meta string for the adapter
      let rawMeta = ''
      if (lineNumbersAttr) rawMeta += ' lineNumbers'
      if (wordWrapAttr) rawMeta += ' wordWrap'
      if (titleAttr && typeof titleAttr.value === 'string') {
        rawMeta += ` title="${titleAttr.value}"`
      }

      const options = adapter.getOptions('tsx', rawMeta)
      const html = highlighter.codeToHtml(code, options)

      // Inject the highlighted HTML back into the component props
      node.attributes = (node.attributes ?? []).filter(
        (a: any) => a.name !== 'highlightedHtml',
      )
      node.attributes.push({
        type: 'mdxJsxAttribute',
        name: 'highlightedHtml',
        value: html,
      })
    })
  }
}
