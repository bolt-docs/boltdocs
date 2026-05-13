import { visit } from 'unist-util-visit'
import { MDX_NODES } from './constants'

/**
 * Remark plugin that captures the code fence meta string (e.g., lineNumbers)
 * and attaches it to hProperties as 'metastring'.
 * This ensures the metadata survives the transformation to Rehype (HAST).
 */
export function remarkMetaPlugin() {
  return (tree: any) => {
    visit(tree, MDX_NODES.CODE, (node: any) => {
      if (node.meta) {
        node.data = node.data || {}
        node.data.hProperties = node.data.hProperties || {}
        node.data.hProperties.metastring = node.meta
      }
    })
  }
}
