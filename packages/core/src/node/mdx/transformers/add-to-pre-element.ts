import type { ShikiTransformer } from 'shiki'
import { DATA_ATTRIBUTES, DEFAULTS } from '../constants'

const addTitleProperty = (): ShikiTransformer => {
  return {
    name: 'AddTitleProperty',
    pre(node) {
      const parsedMeta = this.options.meta as Record<string, any> | undefined
      const title = parsedMeta?.title

      if (title) {
        node.properties[DATA_ATTRIBUTES.TITLE] = title
      }
    },
  }
}

const addLanguageProperty = (): ShikiTransformer => {
  return {
    name: 'AddLanguageProperty',
    pre(node) {
      node.properties[DATA_ATTRIBUTES.LANG] = this.options.lang || DEFAULTS.LANG
    },
  }
}

export { addTitleProperty, addLanguageProperty }
