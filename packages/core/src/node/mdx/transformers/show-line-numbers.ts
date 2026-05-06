import type { ShikiTransformer } from 'shiki'

interface ShowLineNumbersOptions {
  /**
   * Always show line numbers regardless of meta properties
   * @default false
   */
  activateByDefault?: boolean
}

/**
 * Shiki transformer to add line numbers class to the pre element.
 */
export const showLineNumbers = (
  options: ShowLineNumbersOptions = {},
): ShikiTransformer => {
  const { activateByDefault = false } = options

  return {
    name: 'boltdocs:line-numbers',
    pre(node) {
      const rawMeta = this.options.meta?.__raw || ''
      const hasLineNumbersMeta = /lineNumbers|showLineNumbers/.test(rawMeta)
      const shouldAdd = activateByDefault || hasLineNumbersMeta

      if (shouldAdd) {
        this.addClassToHast(node, 'shiki-line-numbers')
      }
    },
  }
}
