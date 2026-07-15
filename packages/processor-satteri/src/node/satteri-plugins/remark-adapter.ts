import { defineMdastPlugin } from 'satteri'
import type { MdastPluginDefinition, MdastContent } from 'satteri'
import type { Code } from 'mdast'

/**
 * Minimal interface matching the parts of `MdastVisitorContext` we use.
 * `MdastVisitorContext` is a class exported from satteri's dist but not
 * re-exported from the index, so we define what we need locally.
 */
interface MdastVisitorContext {
  parent(node: Readonly<{ type: string }>): { children: unknown[] } | undefined
  indexOf(node: Readonly<{ type: string }>): number | undefined
}

/**
 * A remark transformer function: receives a tree and may return a value.
 */
type RemarkTransformer = (tree: {
  type: 'root'
  children: unknown[]
}) => unknown

/**
 * A remark plugin factory: `(config?) => transformer`.
 */
type RemarkPluginFactory = (
  config?: Record<string, unknown>,
) => RemarkTransformer | undefined

/**
 * Anything that can be passed as a remark plugin.
 * - Factory function (most common unified pattern)
 * - Pre-built transformer function
 * - Sätteri MDAST plugin definition (passed through as-is)
 */
type RemarkPluginLike =
  | RemarkPluginFactory
  | RemarkTransformer
  | MdastPluginDefinition
  | undefined
  | null

/**
 * Adapter for legacy remark plugins.
 * Wraps unified/remark transformer plugins into Sätteri MDAST plugins.
 *
 * Supports the most common remark pattern:
 *   (tree) => { visitNodes(tree, nodeType, visitor) }
 * where the visitor can replace nodes in-place.
 */
export function wrapRemarkPlugin(
  remarkPlugin: RemarkPluginLike,
): MdastPluginDefinition | null {
  if (!remarkPlugin) return null

  // If already a Sätteri MDAST plugin (has visitor methods), return as-is
  if (typeof remarkPlugin === 'object' && 'name' in remarkPlugin) {
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
    ] as const
    const hasMdastVisitors = visitorKeys.some(
      (k) =>
        k in (remarkPlugin as object) &&
        typeof (remarkPlugin as unknown as Record<string, unknown>)[k] ===
          'function',
    )
    if (hasMdastVisitors) return remarkPlugin as MdastPluginDefinition
  }

  // Factory function pattern — invoke to get the transformer
  let transformer: unknown
  try {
    transformer =
      typeof remarkPlugin === 'function'
        ? (
            remarkPlugin as (
              ...args: unknown[]
            ) => RemarkTransformer | undefined
          )()
        : null
  } catch {
    // Factory threw — the original might be a direct transformer
    // that failed because it was called with undefined tree.
    transformer = null
  }

  // If factory returned a transformer function, use it
  if (typeof transformer === 'function') {
    return createMdastWrapper(transformer as RemarkTransformer)
  }

  // Factory didn't return a function — try using the original directly as transformer.
  // This handles direct transformer functions like `(tree) => { visit(tree, ...) }`
  // that are not wrapped in a factory closure.
  if (typeof remarkPlugin === 'function') {
    return createMdastWrapper(remarkPlugin as unknown as RemarkTransformer)
  }

  console.warn(
    `[satteri] Cannot convert remark plugin "${(remarkPlugin as { name?: string })?.name ?? 'unknown'}" to Sätteri MDAST.`,
  )
  return null
}

/**
 * Creates a Sätteri MDAST plugin that wraps a remark transformer.
 *
 * The remark transformer is called with a synthetic tree. We detect mutations
 * (node replacements) by comparing the tree before and after.
 */
function createMdastWrapper(
  transformer: RemarkTransformer,
): MdastPluginDefinition {
  return defineMdastPlugin({
    name: 'satteri-remark-adapter',
    code(node: Readonly<Code>, ctx: MdastVisitorContext): MdastContent | void {
      try {
        const parent = ctx.parent(node)
        if (!parent) return

        const index = ctx.indexOf(node)
        if (index === undefined) return

        // Create a synthetic tree that the remark transformer can walk
        const syntheticTree: { type: 'root'; children: unknown[] } = {
          type: 'root',
          children: [node],
        }

        // Call the remark transformer — it may mutate the tree
        const result = transformer(syntheticTree)

        // Handle async transformers (skip for now)
        if (result && typeof (result as Promise<unknown>).then === 'function') {
          return
        }

        // Check if the node was replaced
        if (syntheticTree.children[0] !== node) {
          const replacement = syntheticTree.children[0] as
            | MdastContent
            | undefined
          if (replacement) {
            return replacement
          }
        }
      } catch {
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
  remarkPlugin: RemarkPluginLike,
  config: Record<string, unknown>,
  componentName: string,
  language: string,
): MdastPluginDefinition | null {
  if (!remarkPlugin) return null

  // Extract the transformer function
  let transformer: unknown
  try {
    transformer =
      typeof remarkPlugin === 'function'
        ? (remarkPlugin as RemarkPluginFactory)(config)
        : null
  } catch {
    return null
  }

  if (typeof transformer !== 'function') return null

  return defineMdastPlugin({
    name: `satteri-${language}-adapter`,
    code(node: Readonly<Code>, _ctx: MdastVisitorContext): MdastContent | void {
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
      } as unknown as MdastContent
    },
  })
}
