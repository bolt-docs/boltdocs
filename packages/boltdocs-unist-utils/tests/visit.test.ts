import { describe, it, expect } from 'vitest'
import type { Node, Parent } from 'unist'
import {
  MDX_NODES,
  visitNodes,
  visitRehypeElements,
  visitMdxElements,
  visitRemarkHeadings,
  visitRemarkLinks,
} from '../src'
import type { CodeNode, ElementNode, MdxJsxElement } from '../src/types'

function makeRoot(children: Node[]): { type: 'root'; children: Node[] } {
  return { type: 'root', children }
}

describe('visitNodes', () => {
  it('visits by type name', () => {
    const code: CodeNode = {
      type: 'code',
      lang: 'ts',
      value: 'x',
    }
    const tree = makeRoot([code])
    const seen: CodeNode[] = []
    visitNodes<CodeNode>(tree, MDX_NODES.CODE, (node) => {
      seen.push(node)
    })
    expect(seen).toEqual([code])
  })

  it('visits by type name array', () => {
    const a = { type: 'heading', depth: 1, children: [] } as unknown as Node
    const b = { type: 'link', url: 'x', children: [] } as unknown as Node
    const tree = makeRoot([a, b])
    const seen: string[] = []
    visitNodes(tree, ['heading', 'link'], (n) => seen.push(n.type))
    expect(seen).toEqual(['heading', 'link'])
  })

  it('visits by predicate function', () => {
    const tree = makeRoot([
      { type: 'code', lang: 'mermaid', value: '' } as unknown as Node,
      { type: 'code', lang: 'ts', value: '' } as unknown as Node,
    ])
    const seen: string[] = []
    visitNodes(
      tree,
      (n) => n.type === 'code' && n.lang === 'mermaid',
      (n) => seen.push(n.type),
    )
    expect(seen).toEqual(['code'])
  })

  it('provides index + parent for in-place replacement', () => {
    const tree = makeRoot([
      { type: 'paragraph', children: [] } as unknown as Node,
    ])
    let replacement: Node | undefined
    visitNodes(tree, 'paragraph', (node, index, parent) => {
      replacement = { type: 'html', value: '<p/>' } as unknown as Node
      ;(parent as Parent).children[index] = replacement
    })
    expect(replacement).toBeDefined()
    expect((tree.children[0] as { type: string }).type).toBe('html')
  })

  it('no-ops on falsy tree', () => {
    expect(() =>
      visitNodes(null as unknown as Node, 'code', () => {}),
    ).not.toThrow()
  })
})

describe('visitRehypeElements', () => {
  it('visits tagName matches', () => {
    const tree = makeRoot([
      {
        type: 'element',
        tagName: 'pre',
        children: [],
      } as unknown as Node,
      {
        type: 'element',
        tagName: 'p',
        children: [],
      } as unknown as Node,
    ])
    const seen: ElementNode[] = []
    visitRehypeElements(tree, 'pre', (el) => seen.push(el))
    expect(seen).toHaveLength(1)
    expect(seen[0]!.tagName).toBe('pre')
  })
})

describe('visitMdxElements', () => {
  it('visits by name', () => {
    const a: MdxJsxElement = { type: 'mdxJsxFlowElement', name: 'Mermaid' }
    const b: MdxJsxElement = { type: 'mdxJsxFlowElement', name: 'Code' }
    const tree = makeRoot([a as unknown as Node, b as unknown as Node])
    const seen: MdxJsxElement[] = []
    visitMdxElements(tree, 'Mermaid', (n) => seen.push(n))
    expect(seen).toHaveLength(1)
    expect(seen[0]!.name).toBe('Mermaid')
  })

  it('accepts array of names (OR semantic)', () => {
    const tree = makeRoot([
      { type: 'mdxJsxFlowElement', name: 'Math' } as unknown as Node,
      { type: 'mdxJsxFlowElement', name: 'Code' } as unknown as Node,
    ])
    const seen: string[] = []
    visitMdxElements(tree, ['Math', 'Code'], (n) => seen.push(n.name ?? ''))
    expect(seen.sort()).toEqual(['Code', 'Math'])
  })
})

describe('visitRemarkHeadings / visitRemarkLinks', () => {
  it('visits headings', () => {
    const tree = makeRoot([
      {
        type: 'heading',
        depth: 1,
        children: [{ type: 'text', value: 'A' }],
      } as unknown as Node,
      { type: 'paragraph', children: [] } as unknown as Node,
    ])
    let count = 0
    visitRemarkHeadings(tree, () => count++)
    expect(count).toBe(1)
  })

  it('visits links', () => {
    const tree = makeRoot([
      { type: 'link', url: '/a', children: [] } as unknown as Node,
      { type: 'link', url: '/b', children: [] } as unknown as Node,
    ])
    let count = 0
    visitRemarkLinks(tree, () => count++)
    expect(count).toBe(2)
  })
})
