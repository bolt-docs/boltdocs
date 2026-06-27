import { defineMdastPlugin } from 'satteri'

/**
 * Adapter for legacy remark plugins.
 * Wraps unified/remark transformer plugins into Sätteri MDAST plugins.
 *
 * Supports the most common remark pattern:
 *   (tree) => { visitNodes(tree, nodeType, visitor) }
 * where the visitor can replace nodes in-place.
 */
export function wrapRemarkPlugin(remarkPlugin: any): any {
  if (!remarkPlugin) return null

  // If already a Sätteri MDAST plugin (has visitor methods), return as-is
  if (remarkPlugin.name && typeof remarkPlugin === 'object') {
    const visitorKeys = [
      'paragraph',
      'heading',
      'thematicBreak',
      'blockquote',
      'list',
      'listItem',
      'html',
      'code',
      'definition',
      'text',
      'emphasis',
      'strong',
      'inlineCode',
      'break',
      'link',
      'image',
    ]
    const hasMdastVisitors = Object.keys(remarkPlugin).some(
      (k) => visitorKeys.includes(k) && typeof remarkPlugin[k] === 'function',
    )
    if (hasMdastVisitors) return remarkPlugin
  }

  // Factory function pattern — invoke to get the transformer
  let transformer: any
  try {
    transformer =
      typeof remarkPlugin === 'function' ? remarkPlugin() : remarkPlugin
  } catch {
    return null
  }

  // If it's a function (standard remark transformer), wrap it
  if (typeof transformer === 'function') {
    return createMdastWrapper(transformer)
  }

  console.warn(
    `[satteri] Cannot convert remark plugin "${transformer?.name || 'unknown'}" to Sätteri MDAST.`,
  )
  return null
}

/**
 * Creates a Sätteri MDAST plugin that wraps a remark transformer.
 *
 * The remark transformer is called with a synthetic tree. We detect mutations
 * (node replacements) by comparing the tree before and after.
 */
function createMdastWrapper(transformer: Function): any {
  return defineMdastPlugin({
    name: 'satteri-remark-adapter',
    code(node: any, ctx: any) {
      try {
        // Build a minimal tree with just this code node
        const parent = ctx.parent(node)
        if (!parent) return

        const index = ctx.indexOf(node)
        if (index === undefined) return

        // Create a synthetic tree that the remark transformer can walk
        const syntheticTree = {
          type: 'root',
          children: [node],
        }

        // Call the remark transformer — it may mutate the tree
        const result = transformer(syntheticTree)

        // Handle async transformers (skip for now)
        if (result && typeof result.then === 'function') {
          return
        }

        // Check if the node was replaced (transformer modified syntheticTree.children)
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
  })
}

/**
 * Wraps a remark plugin that visits code blocks with specific languages.
 * Used for plugins like mermaid that transform code blocks into JSX elements.
 */
export function wrapRemarkCodePlugin(
  remarkPlugin: any,
  config: Record<string, any>,
  componentName: string,
  language: string,
): any {
  if (!remarkPlugin) return null

  // Extract the transformer function
  let transformer: any
  try {
    transformer =
      typeof remarkPlugin === 'function' ? remarkPlugin(config) : remarkPlugin
  } catch {
    return null
  }

  if (typeof transformer !== 'function') return null

  return defineMdastPlugin({
    name: `satteri-${language}-adapter`,
    code(node: any, ctx: any) {
      const nodeLang = node.lang || ''
      if (nodeLang !== language) return

      const rawCode = node.value || ''

      return {
        type: 'mdxJsxFlowElement',
        name: componentName,
        attributes: [
          { type: 'mdxJsxAttribute', name: 'chart', value: rawCode },
          {
            type: 'mdxJsxAttribute',
            name: 'config',
            value: JSON.stringify(config),
          },
        ],
        children: [],
      }
    },
  })
}
