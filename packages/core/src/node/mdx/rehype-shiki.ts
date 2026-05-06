import { visit } from 'unist-util-visit'
import type { BoltdocsConfig } from '../config'
import { ShikiAdapter } from './shiki-adapter'

/**
 * Custom rehype plugin to perform syntax highlighting at build time for
 * standard Markdown code blocks.
 */
export function rehypeShiki(config?: BoltdocsConfig) {
  const adapter = new ShikiAdapter(config)

  return async (tree: any) => {
    const highlighter = await adapter.getHighlighter()

    visit(tree, 'element', (node: any) => {
      // Handle standard Markdown code blocks
      if (node.tagName === 'pre' && node.children?.[0]?.tagName === 'code') {
        const codeNode = node.children[0]
        const className = codeNode.properties?.className || []
        const langMatch = className.find((c: string) =>
          c.startsWith('language-'),
        )
        const lang = langMatch ? langMatch.slice(9) : 'text'
        const code = codeNode.children[0]?.value || ''

        // Priority: properties.metastring (from our remarkMetaPlugin) > node.data.meta
        const meta =
          codeNode.properties?.metastring || (codeNode.data as any)?.meta || ''

        const options = adapter.getOptions(lang, meta)
        const html = highlighter.codeToHtml(code, options)

        // Parse title to pass to CodeBlock
        const titleMatch = meta.match(/title=(["'])(.*?)\1/)
        if (titleMatch) {
          node.properties['data-title'] = titleMatch[2]
        }

        // Inject highlighted HTML and mark as highlighted for CodeBlock component
        node.properties['data-highlighted'] = 'true'
        node.properties['data-highlighted-html'] = html
        node.properties['data-lang'] = lang
        node.children = []
      }
    })
  }
}
