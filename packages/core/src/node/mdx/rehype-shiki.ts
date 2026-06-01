import { error as logError } from '@bdocs/dui'
import type { BoltdocsConfig } from '../config'
import { getShikiAdapter } from './shiki-adapter'
import { DATA_ATTRIBUTES, DEFAULTS, SHIKI_CLASSES } from './constants'
import { visitNodes, parseMetaString, SKIP } from '../plugins/plugin-utils'
import { MDX_NODES } from './constants'
import type { ElementNode } from './types'

/**
 * Custom rehype plugin to perform syntax highlighting at build time for
 * standard Markdown code blocks.
 */
export function rehypeShiki(config?: BoltdocsConfig) {
  const adapter = getShikiAdapter(config)

  return async (tree: any) => {
    const highlighter = await adapter.getHighlighter()

    visitNodes<ElementNode>(tree, MDX_NODES.ELEMENT, (preNode) => {
      if (preNode.tagName !== 'pre') return
      const codeNode = preNode.children?.[0] as ElementNode | undefined
      if (
        !codeNode ||
        codeNode.type !== MDX_NODES.ELEMENT ||
        codeNode.tagName !== 'code'
      ) {
        return
      }

      const className: string[] = codeNode.properties?.className || []
      const langMatch = className.find((c: string) => c.startsWith('language-'))
      const lang = langMatch ? langMatch.slice(9) : DEFAULTS.MDX_DEFAULT_LANG

      if (lang === 'mermaid') {
        return
      }

      const metaStr: string =
        codeNode.properties?.metastring || (codeNode as any).data?.meta || ''

      const parsedMeta = parseMetaString(metaStr)
      const options = adapter.getOptions(lang, parsedMeta)

      const codeText =
        (codeNode.children?.[0] as { value?: string })?.value || ''

      try {
        const hast = highlighter.codeToHast(codeText, options)
        const preElement = hast.type === 'root' ? hast.children[0] : hast
        preNode.children = preElement.children
        preNode.properties = {
          ...preNode.properties,
          ...preElement.properties,
          [DATA_ATTRIBUTES.HIGHLIGHTED]: 'true',
          [DATA_ATTRIBUTES.LANG]: lang,
        }
      } catch (e) {
        logError(`[rehypeShiki] Failed to highlight code block:`, e)
        preNode.properties = preNode.properties || {}
        preNode.properties.className = [
          ...(preNode.properties.className || []),
          SHIKI_CLASSES.FALLBACK,
        ]
        preNode.properties[DATA_ATTRIBUTES.HIGHLIGHTED] = 'false'
        preNode.properties[DATA_ATTRIBUTES.LANG] = lang
      }

      if (parsedMeta.title) {
        preNode.properties[DATA_ATTRIBUTES.TITLE] = parsedMeta.title
      }

      return SKIP
    })
  }
}
