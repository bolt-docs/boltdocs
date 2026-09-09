import { describe, it, expect } from 'vitest'
import { showLineNumbers } from '../../src/node/mdx/transformers/show-line-numbers'
import { showWordWrap } from '../../src/node/mdx/transformers/show-word-wrap'
import {
  addTitleProperty,
  addLanguageProperty,
} from '../../src/node/mdx/transformers/add-to-pre-element'
import {
  SHIKI_CLASSES,
  DATA_ATTRIBUTES,
  DEFAULTS,
} from '../../src/node/mdx/constants'

// Build a minimal Shiki transformer context: the transformer receives
// `this` with `options` and `addClassToHast(node, cls)`.
function runTransformer(
  transformer: { pre: (node: any) => void; name: string },
  overrides: Record<string, any> = {},
): { node: Record<string, any>; added: string[] } {
  const opts = {
    lang: 'js',
    meta: { title: 'demo', lineNumbers: true, wordWrap: true },
    ...overrides,
  }
  const added: string[] = []
  const node = { properties: {} }
  const self = {
    options: opts,
    addClassToHast: (n: any, cls: string) => {
      added.push(cls)
    },
  }
  const fn: (n: any) => void = (transformer as any).pre.bind(self)
  fn(node)
  return { node, added }
}

describe('showLineNumbers transformer', () => {
  it('has a stable name and a pre transformer', () => {
    const line = showLineNumbers()
    expect(line.name).toBe('boltdocs:line-numbers')
    expect(typeof line.pre).toBe('function')
  })

  it('adds the line-numbers class when meta enables it', () => {
    const { added } = runTransformer(showLineNumbers())
    expect(added).toContain(SHIKI_CLASSES.LINE_NUMBERS)
  })

  it('does not add the class when meta disables it', () => {
    const { added } = runTransformer(showLineNumbers(), {
      meta: { lineNumbers: false },
    })
    expect(added).toHaveLength(0)
  })

  it('forces the class via activateByDefault', () => {
    const { added } = runTransformer(
      showLineNumbers({ activateByDefault: true }),
      {
        meta: {},
      },
    )
    expect(added).toContain(SHIKI_CLASSES.LINE_NUMBERS)
  })
})

describe('showWordWrap transformer', () => {
  it('adds the word-wrap class when meta enables it', () => {
    const { added } = runTransformer(showWordWrap())
    expect(added).toContain(SHIKI_CLASSES.WORD_WRAP)
  })

  it('activates by default when requested', () => {
    const { added } = runTransformer(
      showWordWrap({ activateByDefault: true }),
      {
        meta: {},
      },
    )
    expect(added).toContain(SHIKI_CLASSES.WORD_WRAP)
  })
})

describe('add-to-pre-element transformers', () => {
  it('adds the title property when meta has a title', () => {
    const { node } = runTransformer(addTitleProperty())
    expect(node.properties[DATA_ATTRIBUTES.TITLE]).toBe('demo')
  })

  it('adds the language property from options', () => {
    const { node } = runTransformer(addLanguageProperty())
    expect(node.properties[DATA_ATTRIBUTES.LANG]).toBe('js')
  })

  it('falls back to the default language when missing', () => {
    const { node } = runTransformer(addLanguageProperty(), { lang: '' })
    expect(node.properties[DATA_ATTRIBUTES.LANG]).toBe(DEFAULTS.LANG)
  })
})
