import type { ShikiTransformer } from 'shiki'
import { SHIKI_CLASSES } from '../constants'

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
      const parsedMeta = this.options.meta as Record<string, any> | undefined
      const hasWordWrapMeta = parsedMeta?.wordWrap === true
      const shouldAdd = activateByDefault || hasWordWrapMeta

      if (shouldAdd) {
        this.addClassToHast(node, SHIKI_CLASSES.WORD_WRAP)
      }
    },
  }
}
