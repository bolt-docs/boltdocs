import { defineHastPlugin } from 'satteri'

/**
 * Adapter for legacy rehype plugins.
 * Wraps unified/rehype transformer plugins into Sätteri HAST plugins.
 *
 * Supports the most common rehype pattern:
 *   (tree) => { visit(tree, 'element', visitor) }
 */
export function wrapHastPlugin(rehypePlugin: any): any {
  if (!rehypePlugin) return null

  // If already a Sätteri HAST plugin (has visitor methods), return as-is
  if (rehypePlugin.name && typeof rehypePlugin === 'object') {
    const visitorKeys = [
      'root',
      'element',
      'text',
      'comment',
      'doctype',
      'script',
      'style',
      'template',
    ]
    const hasHastVisitors = Object.keys(rehypePlugin).some(
      (k) => visitorKeys.includes(k) && typeof rehypePlugin[k] === 'function',
    )
    if (hasHastVisitors) return rehypePlugin
  }

  // Factory function pattern — invoke to get the transformer
  let transformer: any
  try {
    transformer =
      typeof rehypePlugin === 'function' ? rehypePlugin() : rehypePlugin
  } catch {
    return null
  }

  // If it's a function (standard rehype transformer), wrap it
  if (typeof transformer === 'function') {
    return createHastWrapper(transformer)
  }

  console.warn(
    `[satteri] Cannot convert rehype plugin "${transformer?.name || 'unknown'}" to Sätteri HAST.`,
  )
  return null
}

/**
 * Creates a Sätteri HAST plugin that wraps a rehype transformer.
 */
function createHastWrapper(transformer: Function): any {
  return defineHastPlugin({
    name: 'satteri-rehype-adapter',
    element: {
      async visit(node: any, ctx: any) {
        try {
          // Build a minimal tree with just this element
          const syntheticTree = {
            type: 'root',
            children: [node],
          }

          // Call the rehype transformer
          const result = transformer(syntheticTree)

          // Handle async transformers
          if (result && typeof result.then === 'function') {
            await result
          }

          // Check if the node was replaced
          if (syntheticTree.children[0] !== node) {
            const replacement = syntheticTree.children[0]
            if (replacement) {
              return replacement
            }
          }
        } catch (e) {
          // Silently ignore — plugin will fall through
        }
      },
    },
  })
}
