/**
 * String constants for every unist/MDX node type we traverse.
 *
 * These mirror the values inside `remark`/`rehype`/`mdx-js` so plugin authors do
 * not have to import deep paths from `mdast-util-mdx-jsx`, `hast-util-*` or
 * `unist-util-visit` just to write `visit(tree, MDX_NODES.CODE, …)`.
 */
export const MDX_NODES = {
  ROOT: 'root',
  ELEMENT: 'element',
  TEXT: 'text',
  COMMENT: 'comment',
  CODE: 'code',
  INLINE_CODE: 'inlineCode',
  HEADING: 'heading',
  PARAGRAPH: 'paragraph',
  LINK: 'link',
  IMAGE: 'image',
  LIST: 'list',
  LIST_ITEM: 'listItem',
  JSX_FLOW_ELEMENT: 'mdxJsxFlowElement',
  JSX_TEXT_ELEMENT: 'mdxJsxTextElement',
  JSX_ATTRIBUTE: 'mdxJsxAttribute',
  FLOW_EXPRESSION: 'mdxFlowExpression',
  TEXT_EXPRESSION: 'mdxTextExpression',
  ESM: 'mdxjsEsm',
} as const

export type MdxNodeType = (typeof MDX_NODES)[keyof typeof MDX_NODES]

/**
 * Re-export `SKIP` and `EXIT` from `unist-util-visit` under a stable surface.
 * Plugin authors (and core) reference these for short-circuiting traversal.
 */
export { SKIP, EXIT } from 'unist-util-visit'
