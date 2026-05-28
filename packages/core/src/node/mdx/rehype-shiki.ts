import { error as logError } from '@bdocs/dui'
import { visit } from 'unist-util-visit'
import type { BoltdocsConfig } from '../config'
import { getShikiAdapter, parseMetaString, escapeHtml } from './shiki-adapter'
import type { ElementNode } from './types'
import {
  DATA_ATTRIBUTES,
  DEFAULTS,
  HTML_TAGS,
  MDX_NODES,
  SHIKI_CLASSES,
} from './constants'

/**
 * Custom rehype plugin to perform syntax highlighting at build time for
 * standard Markdown code blocks.
 */
export function rehypeShiki(config?: BoltdocsConfig) {
  // Use cached module-level adapter singleton to improve rebuild performance
  const adapter = getShikiAdapter(config)

  return async (tree: any) => {
    const highlighter = await adapter.getHighlighter()

    visit(tree, MDX_NODES.ELEMENT, (node: ElementNode) => {
      // Handle standard Markdown code blocks: <pre><code>...</code></pre>
      if (
        node.tagName === HTML_TAGS.PRE &&
        node.children?.[0]?.type === MDX_NODES.ELEMENT &&
        node.children[0].tagName === HTML_TAGS.CODE
      ) {
        const codeNode = node.children[0] as ElementNode
        const className: string[] = codeNode.properties?.className || []
        const langMatch = className.find((c: string) =>
          c.startsWith('language-'),
        )
        const lang = langMatch ? langMatch.slice(9) : DEFAULTS.MDX_DEFAULT_LANG

        // Skip Shiki highlighting for mermaid blocks since they are client-side rendered
        if (lang === 'mermaid') {
          return
        }

        const code = codeNode.children?.[0]?.value || ''

        // Extract original markdown meta string
        const metaStr: string =
          codeNode.properties?.metastring || (codeNode as any).data?.meta || ''

        // Parse metadata robustly using structured approach
        const parsedMeta = parseMetaString(metaStr)

        const options = adapter.getOptions(lang, parsedMeta)
        let html = ''

        try {
          html = highlighter.codeToHtml(code, options)
        } catch (e) {
          logError(`[rehypeShiki] Failed to highlight code block:`, e)
          // Graceful fallback to plain HTML escaping
          html = `<pre class="${SHIKI_CLASSES.FALLBACK}"><code>${escapeHtml(code)}</code></pre>`
        }

        node.properties = node.properties || {}

        // Bind title to data attribute if defined
        if (parsedMeta.title) {
          node.properties[DATA_ATTRIBUTES.TITLE] = parsedMeta.title
        }

        // Inject highlighted HTML and mark as processed for frontend CodeBlock hydrated wrapper
        node.properties[DATA_ATTRIBUTES.HIGHLIGHTED] = 'true'
        node.properties[DATA_ATTRIBUTES.HIGHLIGHTED_HTML] = html
        node.properties[DATA_ATTRIBUTES.LANG] = lang

        // Clear the pre children as we rendered statically via data-highlighted-html
        node.children = []
      }
    })
  }
}
