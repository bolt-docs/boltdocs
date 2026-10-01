import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Element } from 'hast'

vi.mock('satteri', () => ({
  defineHastPlugin: (def: unknown) => def,
}))

const { satteriRehypeTableWhitespacePlugin } = await import(
  '../node/satteri-plugins/rehype-table-whitespace-plugin'
)

type Visitor = {
  element: { filter: string[]; visit: (node: Element) => unknown }
}

const text = (value: string) => ({ type: 'text', value }) as const
const el = (tagName: string, children: unknown[]): Element =>
  ({ type: 'element', tagName, properties: {}, children }) as unknown as Element

function run(node: Element): Element {
  const plugin = satteriRehypeTableWhitespacePlugin() as Visitor
  const out = plugin.element.visit(node)
  return (out ?? node) as Element
}

describe('satteriRehypeTableWhitespacePlugin', () => {
  let plugin: Visitor
  beforeEach(() => {
    plugin = satteriRehypeTableWhitespacePlugin() as Visitor
  })

  it('targets the elements whose children must be elements only', () => {
    expect(plugin.element.filter).toEqual(
      expect.arrayContaining(['table', 'thead', 'tbody', 'tfoot', 'tr']),
    )
  })

  it('removes whitespace-only text nodes from tbody', () => {
    const tbody = el('tbody', [
      text('\n'),
      el('tr', [text('\n'), el('td', [text('a')]), text('\n')]),
      text('\n'),
    ])

    const out = run(tbody)

    expect(out.children).toHaveLength(1)
    expect((out.children[0] as Element).tagName).toBe('tr')
  })

  it('removes whitespace-only text nodes from tr', () => {
    const tr = el('tr', [
      text('\n'),
      el('td', [text('a')]),
      text('  '),
      el('td', [text('b')]),
      text('\n'),
    ])

    const out = run(tr)

    expect(out.children).toHaveLength(2)
  })

  it('keeps real text content', () => {
    // A table can be used as a layout container, so meaningful text survives.
    const tbody = el('tbody', [text('  hello  '), text('\n')])

    const out = run(tbody)

    expect(out.children).toHaveLength(1)
    expect((out.children[0] as { value: string }).value).toBe('  hello  ')
  })

  it('leaves tables with no whitespace untouched', () => {
    const tbody = el('tbody', [el('tr', [el('td', [text('a')])])])

    const out = run(tbody)

    // Identity matters: rebuilding every node would churn the AST and defeat
    // downstream plugin caches.
    expect(out).toBe(tbody)
  })

  it('preserves comments and other node types', () => {
    const tbody = el('tbody', [
      text('\n'),
      { type: 'comment', value: 'keep' } as never,
      el('tr', []),
    ])

    const out = run(tbody)

    expect(out.children).toHaveLength(2)
    expect((out.children[0] as { type: string }).type).toBe('comment')
  })
})
