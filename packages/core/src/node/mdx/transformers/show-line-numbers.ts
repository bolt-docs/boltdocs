import type { ShikiTransformer } from 'shiki'
import { SHIKI_CLASSES } from '../constants'

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
      const parsedMeta = this.options.meta as Record<string, any> | undefined
      const hasLineNumbersMeta = parsedMeta?.lineNumbers === true
      const shouldAdd = activateByDefault || hasLineNumbersMeta

      if (shouldAdd) {
        this.addClassToHast(node, SHIKI_CLASSES.LINE_NUMBERS)
      }
    },
  }
}
