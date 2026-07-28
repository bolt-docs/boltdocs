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
        const data = (node.data || {}) as Record<string, unknown>
        ctx.setProperty(node, 'data', {
          ...data,
          hProperties: {
            ...((data.hProperties as Record<string, unknown>) || {}),
            metastring: node.meta,
          },
        })
      }
    },
  })
}
