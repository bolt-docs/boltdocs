import { defineHastPlugin } from 'satteri'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .trim()
}

/**
 * Adds id attributes to headings for anchor links.
 * Port of rehypeSlug to Sätteri HAST.
 */
export function satteriRehypeSlugPlugin() {
  return defineHastPlugin({
    name: 'boltdocs-rehype-slug',
    element: {
      filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
      visit(node, ctx) {
        const text = ctx.textContent(node)
        if (text) {
          ctx.setProperty(node, 'id', slugify(text))
        }
      },
    },
  })
}
