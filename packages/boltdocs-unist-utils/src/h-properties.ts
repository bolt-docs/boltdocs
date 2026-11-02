import type { NodeWithHProperties } from './types'

/**
 * Set a single hAST property on a unist node. Lazily creates `data` and
 * `data.hProperties` if absent.
 */
export function setNodeProperty(
  node: NodeWithHProperties | undefined | null,
  key: string,
  value: unknown,
): void {
  if (!node) return
  if (!node.data) {
    node.data = {}
  }
  const data = node.data as { hProperties?: Record<string, unknown> }
  if (!data.hProperties) {
    data.hProperties = {}
  }
  data.hProperties[key] = value
}

/**
 * Read a single hAST property from a unist node. Returns `undefined`
 * when the node, `data` or `hProperties` bag is missing.
 */
export function getNodeProperty(
  node: NodeWithHProperties | undefined | null,
  key: string,
): unknown {
  if (!node?.data) return undefined
  const bag = (node.data as { hProperties?: Record<string, unknown> })
    .hProperties
  return bag?.[key]
}
