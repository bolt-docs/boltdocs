import { defineMdastPlugin } from 'satteri'
import type { MdastPluginDefinition } from 'satteri'

/**
 * Captures code fence meta string (e.g., lineNumbers)
 * and attaches it to hProperties as 'metastring'.
 * Port of remarkMetaPlugin to Sätteri MDAST.
 */
export function satteriRemarkMetaPlugin(): MdastPluginDefinition {
  return defineMdastPlugin({
    name: 'boltdocs-remark-meta',
    code(node, ctx) {
      if (node.meta) {
        ctx.setProperty(node, 'data', {
          ...(node.data || {}),
          hProperties: {
            ...(node.data?.hProperties || {}),
            metastring: node.meta,
          },
        })
      }
    },
  })
}
