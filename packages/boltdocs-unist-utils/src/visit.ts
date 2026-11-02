import { visit } from 'unist-util-visit'
import { MDX_NODES } from './mdx-nodes'
import type { ElementNode, MdxJsxElement, Node, Parent } from './types'

/**
 * `unist-util-visit@5` types its inputs against `unist`'s `Node`/`Parent`,
 * which is structurally compatible with the locally-inlined `Node`/`Parent`
 * exports above. The single cast inside `unistVisit` keeps the public
 * surface 100% typed without taking a direct dependency on the `unist`
 * package.
 */

type Callback<T> = (
  node: T,
  index: number,
  parent: Parent,
) => void | number | boolean | symbol

type TestFn = (node: Node) => boolean
type VisitTest = string | string[] | TestFn

/**
 * General, type-safe visitor over any unist tree. The generic `T` is the
 * narrowed node type the callback expects — pass nothing if you want the
 * wider `Node`.
 */
export function visitNodes<T extends Node = Node>(
  tree: Node,
  test: VisitTest,
  callback: Callback<T>,
): void {
  if (!tree) return
  const testFn: TestFn =
    typeof test === 'function'
      ? test
      : (node: Node) => {
          if (Array.isArray(test)) {
            return test.includes(node.type)
          }
          return node.type === test
        }

  unistVisit(tree, testFn, (node, index, parent) => {
    if (index !== undefined && parent !== undefined) {
      callback(node as T, index, parent)
    }
  })
}

/** Visit hast elements with a specific `tagName`. */
export function visitRehypeElements<T extends ElementNode = ElementNode>(
  tree: Node,
  tagName: string,
  callback: Callback<T>,
): void {
  visitNodes<ElementNode>(tree, MDX_NODES.ELEMENT, (node, index, parent) => {
    if (node.tagName === tagName) {
      callback(node as unknown as T, index, parent)
    }
  })
}

/** Visit MDX JSX elements by `name` (string or string[]). */
export function visitMdxElements(
  tree: Node,
  name: string | string[],
  callback: Callback<MdxJsxElement>,
): void {
  const names = Array.isArray(name) ? name : [name]
  const types: string[] = [
    MDX_NODES.JSX_FLOW_ELEMENT,
    MDX_NODES.JSX_TEXT_ELEMENT,
  ]

  visitNodes<MdxJsxElement>(
    tree,
    (node) => types.includes(node.type),
    (node, index, parent) => {
      if (node.name && names.includes(node.name)) {
        callback(node, index, parent)
      }
    },
  )
}

/** Visit only heading nodes (mdast). */
export function visitRemarkHeadings<T extends Node = Node>(
  tree: Node,
  callback: Callback<T>,
): void {
  if (!tree) return
  unistVisit(tree, MDX_NODES.HEADING, (node, index, parent) => {
    if (index !== undefined && parent !== undefined) {
      callback(node as T, index, parent)
    }
  })
}

/** Visit only link nodes (mdast). */
export function visitRemarkLinks<T extends Node = Node>(
  tree: Node,
  callback: Callback<T>,
): void {
  if (!tree) return
  unistVisit(tree, MDX_NODES.LINK, (node, index, parent) => {
    if (index !== undefined && parent !== undefined) {
      callback(node as T, index, parent)
    }
  })
}

/**
 * Single boundary helper for invoking `unist-util-visit` from anywhere in
 * this package. Centralises the unist↔local Node/Parent type reconciliation
 * so the public visitors stay strongly typed.
 */
function unistVisit(
  tree: Node,
  test: VisitTest,
  callback: (
    node: Node,
    index: number | undefined,
    parent: Parent | undefined,
  ) => void,
): void {
  visit(
    tree as unknown as Parameters<typeof visit>[0],
    test as unknown as Parameters<typeof visit>[1],
    callback as unknown as Parameters<typeof visit>[2],
  )
}
