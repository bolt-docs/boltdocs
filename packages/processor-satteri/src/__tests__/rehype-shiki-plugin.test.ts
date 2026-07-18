import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('satteri', () => ({
  defineHastPlugin: (def: unknown) => def,
}))

// Use vi.hoisted to ensure these are available before vi.mock factories run
// (vi.mock is hoisted above all other code, so variables must be hoisted too)
const { mockHighlighter, mockAdapter } = vi.hoisted(() => {
  const mh = { codeToHast: vi.fn() }
  return {
    mockHighlighter: mh,
    mockAdapter: {
      getHighlighter: vi.fn().mockResolvedValue(mh),
      getOptions: vi.fn().mockReturnValue({ lang: 'javascript' }),
    },
  }
})

vi.mock('boltdocs/node/mdx/shiki-adapter', () => ({
  getShikiAdapter: () => mockAdapter,
}))

const { satteriRehypeShikiPlugin } = await import(
  '../node/satteri-plugins/rehype-shiki-plugin'
)

describe('satteriRehypeShikiPlugin', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns a plugin with correct name', () => {
    const plugin = satteriRehypeShikiPlugin() as {
      name: string
      element: { filter: string[] }
    }
    expect(plugin.name).toBe('boltdocs-rehype-shiki')
  })

  it('filters only pre elements', () => {
    const plugin = satteriRehypeShikiPlugin() as {
      name: string
      element: { filter: string[] }
    }
    expect(plugin.element.filter).toEqual(['pre'])
  })

  it('returns an async visit function', () => {
    const plugin = satteriRehypeShikiPlugin() as {
      name: string
      element: { filter: string[]; visit: (...args: unknown[]) => unknown }
    }
    const result = plugin.element.visit(
      {
        type: 'element',
        tagName: 'pre',
        properties: {},
        children: [
          {
            type: 'element',
            tagName: 'code',
            properties: { className: ['language-javascript'] },
            children: [{ type: 'text', value: 'const x = 1' }],
          },
        ],
      },
      {
        textContent: () => 'const x = 1',
        source: '```js\\nconst x = 1\\n```',
        fileURL: undefined,
        data: {},
        removeNode: vi.fn(),
        replaceNode: vi.fn(),
        insertBefore: vi.fn(),
        insertAfter: vi.fn(),
        wrapNode: vi.fn(),
        prependChild: vi.fn(),
        appendChild: vi.fn(),
        insertChildAt: vi.fn(),
        removeChildAt: vi.fn(),
        setProperty: vi.fn(),
        parent: vi.fn(),
        indexOf: vi.fn(),
        report: vi.fn(),
        getDiagnostics: () => [],
      },
    )
    // visit returns a Promise (it's async), so the result should be a Promise
    expect(result).toBeInstanceOf(Promise)
  })

  it('loads adapter on first visit', async () => {
    mockHighlighter.codeToHast.mockReturnValue({
      type: 'element',
      tagName: 'pre',
      properties: { className: ['shiki'] },
      children: [
        {
          type: 'element',
          tagName: 'code',
          properties: { className: ['language-javascript'] },
          children: [{ type: 'text', value: 'const x = 1' }],
        },
      ],
    })

    const plugin = satteriRehypeShikiPlugin() as {
      element: { filter: string[]; visit: (...args: unknown[]) => unknown }
    }

    const ctx = {
      textContent: () => 'const x = 1',
      source: '```js\\nconst x = 1\\n```',
      fileURL: undefined,
      data: {},
      removeNode: vi.fn(),
      replaceNode: vi.fn(),
      insertBefore: vi.fn(),
      insertAfter: vi.fn(),
      wrapNode: vi.fn(),
      prependChild: vi.fn(),
      appendChild: vi.fn(),
      insertChildAt: vi.fn(),
      removeChildAt: vi.fn(),
      setProperty: vi.fn(),
      parent: vi.fn(),
      indexOf: vi.fn(),
      report: vi.fn(),
      getDiagnostics: () => [],
    }

    await plugin.element.visit(
      {
        type: 'element',
        tagName: 'pre',
        properties: {},
        children: [
          {
            type: 'element',
            tagName: 'code',
            properties: { className: ['language-javascript'] },
            children: [{ type: 'text', value: 'const x = 1' }],
          },
        ],
      },
      ctx,
    )

    expect(mockAdapter.getHighlighter).toHaveBeenCalledTimes(1)
    expect(mockAdapter.getOptions).toHaveBeenCalledWith('javascript', {})
  })

  it('returns shiki-fallback on highlight error', async () => {
    mockHighlighter.codeToHast.mockImplementation(() => {
      throw new Error('highlight error')
    })

    const plugin = satteriRehypeShikiPlugin() as {
      element: { filter: string[]; visit: (...args: unknown[]) => unknown }
    }

    const result = await plugin.element.visit(
      {
        type: 'element',
        tagName: 'pre',
        properties: {},
        children: [
          {
            type: 'element',
            tagName: 'code',
            properties: { className: ['language-javascript'] },
            children: [{ type: 'text', value: 'const x = 1' }],
          },
        ],
      },
      {
        textContent: () => 'const x = 1',
        source: 'test',
        fileURL: undefined,
        data: {},
        removeNode: vi.fn(),
        replaceNode: vi.fn(),
        insertBefore: vi.fn(),
        insertAfter: vi.fn(),
        wrapNode: vi.fn(),
        prependChild: vi.fn(),
        appendChild: vi.fn(),
        insertChildAt: vi.fn(),
        removeChildAt: vi.fn(),
        setProperty: vi.fn(),
        parent: vi.fn(),
        indexOf: vi.fn(),
        report: vi.fn(),
        getDiagnostics: () => [],
      },
    )

    const resultNode = result as { properties: Record<string, unknown> }
    expect(resultNode.properties['data-highlighted']).toBe('false')
    expect(resultNode.properties.className).toContain('shiki-fallback')
  })

  it('skips non-code pre elements gracefully', async () => {
    mockHighlighter.codeToHast.mockClear()

    const plugin = satteriRehypeShikiPlugin() as {
      element: { filter: string[]; visit: (...args: unknown[]) => unknown }
    }

    // pre without a code child
    const result = await plugin.element.visit(
      {
        type: 'element',
        tagName: 'pre',
        properties: {},
        children: [{ type: 'text', value: 'just text' }],
      },
      {
        textContent: () => 'just text',
        source: 'test',
        fileURL: undefined,
        data: {},
        removeNode: vi.fn(),
        replaceNode: vi.fn(),
        insertBefore: vi.fn(),
        insertAfter: vi.fn(),
        wrapNode: vi.fn(),
        prependChild: vi.fn(),
        appendChild: vi.fn(),
        insertChildAt: vi.fn(),
        removeChildAt: vi.fn(),
        setProperty: vi.fn(),
        parent: vi.fn(),
        indexOf: vi.fn(),
        report: vi.fn(),
        getDiagnostics: () => [],
      },
    )

    // Should return undefined (no replacement)
    expect(result).toBeUndefined()
  })

  it('skips mermaid code blocks', async () => {
    mockHighlighter.codeToHast.mockClear()

    const plugin = satteriRehypeShikiPlugin() as {
      element: { filter: string[]; visit: (...args: unknown[]) => unknown }
    }

    const result = await plugin.element.visit(
      {
        type: 'element',
        tagName: 'pre',
        properties: {},
        children: [
          {
            type: 'element',
            tagName: 'code',
            properties: { className: ['language-mermaid'] },
            children: [{ type: 'text', value: 'graph TD; A-->B;' }],
          },
        ],
      },
      {
        textContent: () => 'graph TD; A-->B;',
        source: 'test',
        fileURL: undefined,
        data: {},
        removeNode: vi.fn(),
        replaceNode: vi.fn(),
        insertBefore: vi.fn(),
        insertAfter: vi.fn(),
        wrapNode: vi.fn(),
        prependChild: vi.fn(),
        appendChild: vi.fn(),
        insertChildAt: vi.fn(),
        removeChildAt: vi.fn(),
        setProperty: vi.fn(),
        parent: vi.fn(),
        indexOf: vi.fn(),
        report: vi.fn(),
        getDiagnostics: () => [],
      },
    )

    expect(result).toBeUndefined()
  })
})
