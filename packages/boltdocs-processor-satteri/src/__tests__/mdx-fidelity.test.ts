import { describe, expect, it } from 'vitest'
import { mdxToJs, mdxToMdast } from 'satteri'

/**
 * SPEC §2.4: MDX is the source of truth and Sätteri must never lose fidelity.
 *
 * These tests run the REAL parser (no mocks) against one document that carries
 * all four constructs the contract names: a fenced code block, inline HTML, a
 * GFM table and a custom component with props. They check both sides of the
 * pipeline — the parsed mdast tree and the compiled JSX — so a regression in
 * either the parser or the compiler is caught.
 */
const SOURCE = [
  '---',
  'title: Fidelity',
  '---',
  '',
  '```ts',
  'const x = 1',
  '```',
  '',
  '<div data-custom="yes">inline html</div>',
  '',
  '| A | B |',
  '| :-- | --: |',
  '| 1 | 2 |',
  '',
  '<Callout severity="info">hello</Callout>',
  '',
].join('\n')

const OPTIONS = {
  jsxRuntime: 'automatic' as const,
  jsxImportSource: 'react',
  outputFormat: 'program' as const,
  features: { gfm: true, frontmatter: true },
}

type Node = {
  type: string
  lang?: string | null
  value?: string
  name?: string
  attributes?: { name?: string; value?: unknown }[]
  children?: Node[]
}

function flatten(node: Node): Node[] {
  return [node, ...(node.children ?? []).flatMap(flatten)]
}

describe('Sätteri MDX fidelity (SPEC §2.4)', () => {
  it('keeps code blocks, HTML, tables and custom components in the mdast tree', () => {
    const tree = mdxToMdast(SOURCE, { features: OPTIONS.features }) as Node
    const nodes = flatten(tree)

    const code = nodes.find((n) => n.type === 'code')
    expect(code?.lang).toBe('ts')
    expect(code?.value).toContain('const x = 1')

    const html = nodes.find(
      (n) => n.type === 'mdxJsxFlowElement' && n.name === 'div',
    )
    expect(html?.attributes).toContainEqual({
      type: 'mdxJsxAttribute',
      name: 'data-custom',
      value: 'yes',
    })

    const table = nodes.find((n) => n.type === 'table')
    expect(table?.children?.filter((n) => n.type === 'tableRow')).toHaveLength(
      2,
    )
    expect(
      table?.children?.[0]?.children?.map((n) => n.children?.[0]?.value),
    ).toEqual(['A', 'B'])

    const component = nodes.find(
      (n) => n.type === 'mdxJsxFlowElement' && n.name === 'Callout',
    )
    expect(component?.attributes).toContainEqual({
      type: 'mdxJsxAttribute',
      name: 'severity',
      value: 'info',
    })
  })

  it('emits all four constructs in the compiled JSX unchanged', () => {
    const { code, frontmatter } = mdxToJs(SOURCE, OPTIONS)

    expect(frontmatter?.value).toContain('title: Fidelity')

    // Fenced code: language class and the exact source text.
    expect(code).toContain('language-ts')
    expect(code).toContain('const x = 1\\n')

    // Raw HTML keeps its attribute and text content.
    expect(code).toMatch(
      /_jsx\("div",\s*\{\s*"data-custom": "yes",\s*children: "inline html"/,
    )

    // GFM table becomes real table elements, not a text paragraph.
    for (const tag of ['table', 'thead', 'tbody', 'tr', 'th', 'td']) {
      expect(code).toContain(`_components.${tag}`)
    }
    expect(code).toContain('children: "A"')
    expect(code).toContain('children: "B"')

    // Custom component keeps its name, props and children.
    expect(code).toMatch(
      /_jsx\(Callout, \{\s*severity: "info",\s*children: "hello"/,
    )
  })

  it('preserves alignment markers from the table', () => {
    const { code } = mdxToJs(SOURCE, OPTIONS)
    // The `:--` / `--:` alignment is parsed into explicit cell styles.
    expect(code).toContain('textAlign')
  })
})
