import type { ShikiTransformer } from 'shiki'

interface ShowWordWrapOptions {
  /**
   * Always enable word wrap regardless of meta properties
   * @default false
   */
  activateByDefault?: boolean
}

/**
 * Shiki transformer to add word wrap class to the pre element.
 */
export const showWordWrap = (
  options: ShowWordWrapOptions = {},
): ShikiTransformer => {
  const { activateByDefault = false } = options

  return {
    name: 'boltdocs:word-wrap',
    pre(node) {
      const rawMeta = this.options.meta?.__raw || ''
      const hasWordWrapMeta = /wordWrap|word-wrap/.test(rawMeta)
      const shouldAdd = activateByDefault || hasWordWrapMeta

      if (shouldAdd) {
        this.addClassToHast(node, 'shiki-word-wrap')
      }
    },
  }
}
