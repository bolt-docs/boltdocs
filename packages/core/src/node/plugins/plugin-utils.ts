import { visit, SKIP, EXIT } from 'unist-util-visit'
import type { Node, Parent } from 'unist'
import { MDX_NODES } from '../mdx/constants'
import type {
  ElementNode,
  MdxJsxElement,
  MdxJsxAttribute,
  MdxJsxAttributeValueExpression,
} from '../mdx/types'
import { parseMetaString } from '../mdx/shiki-adapter'

export { SKIP, EXIT, parseMetaString }

export interface NodeWithHProperties extends Node {
  data?: {
    hProperties?: Record<string, unknown>
    [key: string]: unknown
  }
}

/**
 * General, type-safe utility to visit nodes in the AST (MDAST/HAST/MDX).
 */
export function visitNodes<T extends Node>(
  tree: Node,
  test: string | string[] | ((node: Node) => boolean),
  callback: (
    node: T,
    index: number,
    parent: Parent,
  ) => void | number | boolean | symbol,
): void {
  if (!tree) return
  const testFn =
    typeof test === 'function'
      ? test
      : (node: Node) => {
          if (Array.isArray(test)) {
            return test.includes(node.type)
          }
          return node.type === test
        }

  visit(
    tree,
    testFn,
    (node: Node, index: number | undefined, parent: Parent | undefined) => {
      if (index !== undefined && parent !== undefined) {
        return callback(node as T, index, parent)
      }
    },
  )
}

export function visitRehypeElements(
  tree: Node,
  tagName: string,
  callback: (
    node: ElementNode,
    index: number,
    parent: Parent,
  ) => void | number | boolean | symbol,
): void {
  visitNodes<ElementNode>(tree, MDX_NODES.ELEMENT, (node, index, parent) => {
    if (node.tagName === tagName) {
      return callback(node, index, parent)
    }
  })
}

export function visitMdxElements(
  tree: Node,
  name: string | string[],
  callback: (
    node: MdxJsxElement,
    index: number,
    parent: Parent,
  ) => void | number | boolean | symbol,
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
        return callback(node, index, parent)
      }
    },
  )
}

export function setNodeProperty(
  node: NodeWithHProperties,
  key: string,
  value: unknown,
): void {
  if (!node) return
  node.data = node.data || {}
  node.data.hProperties = node.data.hProperties || {}
  node.data.hProperties[key] = value
}

export function getNodeProperty(
  node: NodeWithHProperties,
  key: string,
): unknown {
  return node?.data?.hProperties?.[key]
}

export function createMdxAttribute(
  name: string,
  value: unknown,
): MdxJsxAttribute {
  if (typeof value === 'object' && value !== null) {
    return {
      type: MDX_NODES.JSX_ATTRIBUTE,
      name,
      value: value as MdxJsxAttributeValueExpression,
    }
  }
  return {
    type: MDX_NODES.JSX_ATTRIBUTE,
    name,
    value: String(value),
  }
}

export function createRehypeElement(
  tagName: string,
  properties: Record<string, unknown> = {},
  children: Node[] = [],
): ElementNode {
  return {
    type: MDX_NODES.ELEMENT,
    tagName,
    properties,
    children,
  }
}

export function createMdxElement(
  name: string,
  attributes: Record<string, unknown> = {},
  children: Node[] = [],
  isFlow = true,
): MdxJsxElement {
  const mdxAttributes: MdxJsxAttribute[] = Object.entries(attributes).map(
    ([key, val]) => createMdxAttribute(key, val),
  )

  return {
    type: isFlow ? MDX_NODES.JSX_FLOW_ELEMENT : MDX_NODES.JSX_TEXT_ELEMENT,
    name,
    attributes: mdxAttributes,
    children,
  }
}

export function visitRemarkHeadings(
  tree: Node,
  callback: (
    node: any,
    index: number,
    parent: Parent,
  ) => void | number | boolean | symbol,
): void {
  if (!tree) return
  visit(
    tree,
    MDX_NODES.HEADING,
    (node: Node, index: number | undefined, parent: Parent | undefined) => {
      if (index !== undefined && parent !== undefined) {
        return callback(node, index, parent)
      }
    },
  )
}

export function visitRemarkLinks(
  tree: Node,
  callback: (
    node: any,
    index: number,
    parent: Parent,
  ) => void | number | boolean | symbol,
): void {
  if (!tree) return
  visit(
    tree,
    MDX_NODES.LINK,
    (node: Node, index: number | undefined, parent: Parent | undefined) => {
      if (index !== undefined && parent !== undefined) {
        return callback(node, index, parent)
      }
    },
  )
}

export function addNodeClass(node: ElementNode, className: string): void {
  if (!node) return
  node.properties = node.properties || {}
  const classes = node.properties.className
  if (Array.isArray(classes)) {
    if (!classes.includes(className)) {
      classes.push(className)
    }
  } else if (typeof classes === 'string') {
    if (classes !== className) {
      node.properties.className = [classes, className]
    }
  } else {
    node.properties.className = [className]
  }
}

export function removeNodeClass(node: ElementNode, className: string): void {
  if (!node || !node.properties || !node.properties.className) return
  const classes = node.properties.className
  if (Array.isArray(classes)) {
    node.properties.className = classes.filter((c) => c !== className)
  } else if (typeof classes === 'string') {
    if (classes === className) {
      delete node.properties.className
    }
  }
}

export function hasNodeClass(node: ElementNode, className: string): boolean {
  if (!node || !node.properties || !node.properties.className) return false
  const classes = node.properties.className
  if (Array.isArray(classes)) {
    return classes.includes(className)
  }
  if (typeof classes === 'string') {
    return classes === className
  }
  return false
}
