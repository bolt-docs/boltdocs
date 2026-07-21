import { visitNodes, setNodeProperty } from '@bdocs/unist-utils'
import { MDX_NODES } from './constants'
import type { CodeNode } from './types'

/**
 * Remark plugin that captures the code fence meta string (e.g., lineNumbers)
 * and attaches it to hProperties as 'metastring'.
 * This ensures the metadata survives the transformation to Rehype (HAST).
 */
export function remarkMetaPlugin() {
  return (tree: any) => {
    visitNodes<CodeNode>(tree, MDX_NODES.CODE, (node) => {
      if (node.meta) {
        setNodeProperty(
          node as unknown as Parameters<typeof setNodeProperty>[0],
          'metastring',
          node.meta,
        )
      }
    })
  }
}
