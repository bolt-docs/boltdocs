import { defineHastPlugin } from 'satteri'
import type { HastPluginDefinition, HastVisitorContext } from 'satteri'
import type { Element } from 'hast'

/**
 * A rehype transformer function: receives a tree and may return a Promise.
 */
type RehypeTransformer = (tree: {
  type: 'root'
  children: Element[]
}) => void | Promise<void>

/**
 * A rehype plugin factory: zero-arg function that returns a transformer.
 */
type RehypePluginFactory = () => RehypeTransformer | void

/**
 * Anything that can be passed as a rehype plugin.
 * - Factory function (most common unified pattern)
 * - Pre-built transformer function
 * - Sätteri HAST plugin definition (passed through as-is)
 */
type RehypePluginLike =
  | RehypePluginFactory
  | RehypeTransformer
  | HastPluginDefinition
  | undefined
  | null

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
  rehypePlugin: RehypePluginLike,
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
    const hasHastVisitors = visitorKeys.some((k) => {
      const val = (rehypePlugin as unknown as Record<string, unknown>)[k]
      return (
        typeof val === 'function' ||
        (typeof val === 'object' &&
          val !== null &&
          'visit' in (val as Record<string, unknown>))
      )
    })
    if (hasHastVisitors) return rehypePlugin as HastPluginDefinition
  }

  // Factory function pattern — invoke to get the transformer
  let transformer: unknown
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

  const named =
    typeof transformer === 'object' && transformer !== null
      ? (transformer as { name?: string })
      : null
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
      async visit(
        node: Readonly<Element>,
        _ctx: HastVisitorContext,
      ): Promise<Element | void> {
        try {
          // Build a minimal tree with just this element
          const syntheticTree: { type: 'root'; children: Element[] } = {
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
        } catch {
          // Silently ignore
        }
      },
    },
  })
}
