import type { ElementNode } from './types'

/** Normalise `className` to an array (string is allowed by hast but plugins prefer arrays). */
function readClassList(node: ElementNode): string[] {
  const classes = node.properties?.className
  if (Array.isArray(classes)) {
    return classes.filter((c): c is string => typeof c === 'string')
  }
  if (typeof classes === 'string') {
    return classes ? classes.split(/\s+/) : []
  }
  return []
}

function writeClassList(node: ElementNode, list: string[]): void {
  if (!node.properties) {
    node.properties = {}
  }
  node.properties.className = list
}

/** Append a className to a hast element if not already present. */
export function addNodeClass(
  node: ElementNode | undefined | null,
  className: string,
): void {
  if (!node || !className) return
  const list = readClassList(node)
  if (!list.includes(className)) {
    list.push(className)
    writeClassList(node, list)
  }
}

/** Remove every occurrence of a className from a hast element. */
export function removeNodeClass(
  node: ElementNode | undefined | null,
  className: string,
): void {
  if (!node?.properties) return
  const list = readClassList(node).filter((c) => c !== className)
  if (list.length === 0) {
    delete node.properties.className
  } else {
    writeClassList(node, list)
  }
}

/** Membership check on a hast element's class list. */
export function hasNodeClass(
  node: ElementNode | undefined | null,
  className: string,
): boolean {
  if (!node?.properties) return false
  return readClassList(node).includes(className)
}
