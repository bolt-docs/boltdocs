import { defineHastPlugin } from 'satteri'
import type { HastPluginDefinition, HastVisitorContext } from 'satteri'
import type { Element } from 'hast'

/**
 * A rehype transformer function: receives a tree and may return a Promise.
 */
type RehypeTransformer = (tree: RehypeSyntheticTree) => void | Promise<void>

/**
 * Minimal synthetic HAST root used to wrap a single element node.
 */
interface RehypeSyntheticTree {
  type: 'root'
  children: Element[]
}

/**
 * A rehype plugin factory: zero-arg function that returns a transformer.
 */
type RehypePluginFactory = () => RehypeTransformer

/**
 * Anything that can be passed as a rehype plugin.
 * - Factory function (most common unified pattern)
 * - Pre-built transformer function
 * - Sätteri HAST plugin definition (passed through as-is)
 * - Unknown object (validated at runtime)
 */
type RehypePluginLike =
  | RehypePluginFactory
  | RehypeTransformer
  | HastPluginDefinition
  | Record<string, unknown>

/**
 * Adapter for legacy rehype plugins.
 * Wraps unified/rehype transformer plugins into Sätteri HAST plugins.
 *
 * Examples used in Sätteri:
 * - rehype-slug
 * - rehype-autolink-headings
 * - rehype-highlight
 * - rehype-external-links
 * - rehype-raw
 */
export function wrapHastPlugin(
  rehypePlugin: RehypePluginLike | null | undefined,
): HastPluginDefinition | null {
  if (!rehypePlugin) return null

  // If already a Sätteri HAST plugin (has visitor methods), return as-is
  if (typeof rehypePlugin === 'object' && 'name' in rehypePlugin) {
    const visitorKeys = [
      'root',
      'element',
      'text',
      'comment',
      'doctype',
      'script',
      'style',
      'template',
    ] as const
    const hastPlugin = rehypePlugin as Record<string, unknown>
    const hasHastVisitors = visitorKeys.some(
      (k) => k in hastPlugin && typeof hastPlugin[k] === 'function',
    )
    if (hasHastVisitors) return rehypePlugin as HastPluginDefinition
  }

  // Factory function pattern — invoke to get the transformer
  let transformer: RehypeTransformer | unknown
  try {
    transformer =
      typeof rehypePlugin === 'function'
        ? (rehypePlugin as RehypePluginFactory)()
        : rehypePlugin
  } catch {
    return null
  }

  // If it's a function (standard rehype transformer), wrap it
  if (typeof transformer === 'function') {
    return createHastWrapper(transformer as RehypeTransformer)
  }

  const named = transformer as { name?: string } | null
  console.warn(
    `[satteri] Cannot convert rehype plugin "${named?.name ?? 'unknown'}" to Sätteri HAST.`,
  )
  return null
}

/**
 * Creates a Sätteri HAST plugin that wraps a rehype transformer.
 */
function createHastWrapper(
  transformer: RehypeTransformer,
): HastPluginDefinition {
  return defineHastPlugin({
    name: 'satteri-rehype-adapter',
    element: {
      filter: [],
      async visit(node: Readonly<Element>, _ctx: HastVisitorContext) {
        try {
          // Build a minimal tree with just this element
          const syntheticTree: RehypeSyntheticTree = {
            type: 'root',
            children: [node as Element],
          }

          // Call the rehype transformer
          const result = transformer(syntheticTree)

          // Handle async transformers
          if (result instanceof Promise) {
            await result
          }

          // Check if the node was replaced
          if (syntheticTree.children[0] !== node) {
            const replacement = syntheticTree.children[0]
            if (replacement) {
              return replacement
            }
          }
        } catch {}
      },
    },
  })
}
