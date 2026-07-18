/**
 * Public AST node types for unist (mdast + hast).
 *
 * These are intentionally narrower than `unist`'s `Node` umbrella — they
 * describe only the shapes plugin authors actually need to read or build
 * when authoring Boltdocs plugins and MDX transformers. All `children`
 * and `properties` are typed as `unknown[]` / `Record<string, unknown>`
 * so consumers narrow before reading.
 *
 * The shared surface between `boltdocs` core, `@bdocs/processor-satteri`
 * and every official plugin lives here.
 */

// ── Generic unist ─────────────────────────────────────────────────────────
//
// `Node` and `Parent` mirror the structural shape of `unist`'s public
// types so callers that import them from `@bdocs/unist-utils` stay
// assignment-compatible with anything typed against `unist` itself
// (notably `unist-util-visit@^5`).
//
// We declare them here so the package does not need a direct
// dependency on the `unist` types package.

export interface Node {
  type: string
  data?: Record<string, unknown>
  position?: {
    start: { line: number; column: number; offset?: number }
    end: { line: number; column: number; offset?: number }
  }
  children?: Array<Node>
  value?: unknown
}

export interface Parent extends Node {
  children: Array<Node>
}

// ── MDAST ──────────────────────────────────────────────────────────────────

export interface MdxJsxAttributeValueExpression {
  type: 'mdxJsxAttributeValueExpression'
  value: string
  data?: {
    estree?: unknown
  }
}

export interface MdxJsxAttribute {
  type: 'mdxJsxAttribute'
  name: string
  value?: string | MdxJsxAttributeValueExpression
}

/** Recursive child type for JSX elements — narrow before reading. */
export type MdxJsxChild =
  | MdxJsxElement
  | { type: 'text'; value: string }
  | { type: string; value?: unknown; children?: MdxJsxChild[] }

export interface MdxJsxElement {
  type: 'mdxJsxFlowElement' | 'mdxJsxTextElement'
  name: string | null
  attributes?: MdxJsxAttribute[]
  children?: MdxJsxChild[]
}

export interface PlainTextNode {
  type: 'text'
  value: string
}

export interface CodeNode {
  type: 'code'
  lang?: string
  meta?: string
  value: string
  data?: {
    hProperties?: Record<string, unknown>
    [key: string]: unknown
  }
}

// ── HAST ───────────────────────────────────────────────────────────────────

export type HastChild =
  | ElementNode
  | PlainTextNode
  | { type: 'comment'; value: string }
  | { type: string; value?: unknown; children?: HastChild[] }

export interface ElementNode {
  type: 'element'
  tagName: string
  properties?: Record<string, unknown>
  children?: HastChild[]
}

export type HastNode =
  | { type: 'root'; children?: HastNode[] }
  | ElementNode
  | PlainTextNode
  | { type: string; children?: HastNode[]; value?: unknown; data?: unknown }

// ── Generic helpers ───────────────────────────────────────────────────────

/**
 * Extends unist's `Node` with an `hProperties` data bag — the conventional
 * location remark/rehype use to project hAST properties from MDAST.
 */
export interface NodeWithHProperties {
  data?: {
    hProperties?: Record<string, unknown>
    [key: string]: unknown
  }
  [key: string]: unknown
}

// ── Type guards ────────────────────────────────────────────────────────────

export function isMdxJsxElement(value: unknown): value is MdxJsxElement {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'mdxJsxFlowElement'
  )
}

export function isMdxJsxTextElement(value: unknown): value is MdxJsxElement {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'mdxJsxTextElement'
  )
}

export function isMdxJsxLike(value: unknown): value is MdxJsxElement {
  return isMdxJsxElement(value) || isMdxJsxTextElement(value)
}

export function isElementNode(value: unknown): value is ElementNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'element' &&
    typeof (value as { tagName?: unknown }).tagName === 'string'
  )
}

export function isTextNode(value: unknown): value is PlainTextNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'text' &&
    typeof (value as { value?: unknown }).value === 'string'
  )
}
