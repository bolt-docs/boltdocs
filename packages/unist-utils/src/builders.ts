import { MDX_NODES } from './mdx-nodes'
import type {
  ElementNode,
  HastChild,
  MdxJsxAttribute,
  MdxJsxAttributeValueExpression,
  MdxJsxChild,
  MdxJsxElement,
} from './types'

/**
 * Create an MDX JSX attribute.
 *
 * Behaviour, current contract:
 *   - `string`/primitive values  →  stored verbatim as `value: string`.
 *   - `Array` values              →  stringified and stored as `value: string`.
 *   - `object`/`null` values      →  attached as `value: {…}` (the caller is
 *     responsible for wrapping into `mdxJsxAttributeValueExpression` if
 *     the consumer is the unified/MDX serializer rather than a downstream
 *     renderer that reads the value field directly).
 *
 * A stricter builder that always wraps object values into a real
 * `mdxJsxAttributeValueExpression` will land in a future Phase. Until then,
 * prefer `String(value)` for any non-string you intend to serialise.
 */
export function createMdxAttribute(
  name: string,
  value: unknown,
): MdxJsxAttribute {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
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

/** Create a hast `<element>` (e.g. `<pre>`, `<code>`, `<div>`). */
export function createRehypeElement(
  tagName: string,
  properties: Record<string, unknown> = {},
  children: HastChild[] = [],
): ElementNode {
  return {
    type: MDX_NODES.ELEMENT,
    tagName,
    properties,
    children,
  }
}

/**
 * Create an MDX JSX element (`<Foo />` or `<Foo></Foo>`).
 *
 * `@param isFlow` chooses flow (block) vs text (inline) emission. Flow is the
 * default because it is the only form allowed at the top level of an MDX
 * document.
 */
export function createMdxElement(
  name: string,
  attributes: Record<string, unknown> = {},
  children: MdxJsxChild[] = [],
  isFlow = true,
): MdxJsxElement {
  const mdAttributes: MdxJsxAttribute[] = Object.entries(attributes).map(
    ([key, val]) => createMdxAttribute(key, val),
  )

  return {
    type: isFlow ? MDX_NODES.JSX_FLOW_ELEMENT : MDX_NODES.JSX_TEXT_ELEMENT,
    name,
    attributes: mdAttributes,
    children,
  }
}
