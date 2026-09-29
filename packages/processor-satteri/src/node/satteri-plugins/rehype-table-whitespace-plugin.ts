import { defineHastPlugin } from 'satteri'
import type { Element, ElementContent } from 'hast'

/**
 * HTML table sections only accept element children.
 *
 * The MDX compiler preserves the newlines that separate table rows and cells
 * and emits them as text nodes:
 *
 *     _jsxs(_components.tbody, { children: ["\n", _jsxs(tr, ...), "\n"] })
 *
 * React rejects that outright. During server rendering the whitespace is
 * written into the HTML, and on the client the browser's parser has already
 * dropped those text nodes when it builds the table, so hydration compares a
 * `<tbody>` that has whitespace against one that does not and bails out with
 * "whitespace text nodes cannot be a child of <tbody>" (React error #418). The
 * page is then re-rendered entirely on the client.
 *
 * Dropping the whitespace here fixes the source rather than the symptom, and it
 * fixes it for every mapping of the table elements, including user-supplied
 * ones, because the bad nodes never reach the component layer.
 */

/** Elements whose children must be elements only, never text. */
const STRICT_SECTIONS = new Set(['table', 'thead', 'tbody', 'tfoot', 'tr'])

function isWhitespaceOnly(node: ElementContent): boolean {
  return node.type === 'text' && node.value.trim() === ''
}

/**
 * Keeps whitespace that is meaningful, drops the rest.
 *
 * A table that is also a layout container can hold flow content, so only
 * whitespace-only text nodes are removed and real text is preserved.
 */
function cleanChildren(node: Element): Element {
  const children = node.children as ElementContent[]
  const kept = children.filter((child) => !isWhitespaceOnly(child))
  // Identity check: rebuilding the node for a no-op would churn the AST and
  // invalidate downstream plugin caches.
  if (kept.length === children.length) return node
  return { ...node, children: kept } as Element
}

export function satteriRehypeTableWhitespacePlugin() {
  return defineHastPlugin({
    name: 'boltdocs-rehype-table-whitespace',
    element: {
      filter: [...STRICT_SECTIONS],
      visit(node) {
        return cleanChildren(node as Element)
      },
    },
  })
}
