import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('satteri', () => ({
  defineHastPlugin: (def: unknown) => def,
}))

// Use vi.hoisted to ensure these are available before vi.mock factories run
// (vi.mock is hoisted above all other code, so variables must be hoisted too)
const { mockHighlighter, mockAdapter } = vi.hoisted(() => {
  const mh = { codeToHast: vi.fn(), codeToHtml: vi.fn() }
  return {
    mockHighlighter: mh,
    mockAdapter: {
      name: 'shiki',
      initialize: vi.fn().mockResolvedValue(mh),
      getOptions: vi.fn().mockReturnValue({ lang: 'javascript' }),
      ensureLanguage: vi.fn().mockResolvedValue(true),
    },
  }
})

vi.mock('boltdocs/node/highlight', () => ({
  getCodeHighlighterAdapter: () => mockAdapter,
}))

const highlightModule = await import(
  '../node/satteri-plugins/rehype-shiki-plugin'
)
const satteriRehypeCodeHighlightPlugin =
  highlightModule.satteriRehypeCodeHighlightPlugin

// The highlight cache is module-level (per-worker lifetime by design); tests
// share the module, so reset it between cases to keep them independent.
const { clearHighlightCache } = highlightModule

describe('satteriRehypeCodeHighlightPlugin', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    clearHighlightCache()
    mockAdapter.initialize.mockResolvedValue(mockHighlighter)
    mockAdapter.getOptions.mockReturnValue({ lang: 'javascript' })
    mockAdapter.ensureLanguage.mockResolvedValue(true)
  })

  it('returns a plugin with correct name', () => {
    const plugin = satteriRehypeCodeHighlightPlugin() as {
      name: string
      element: { filter: string[] }
    }
    expect(plugin.name).toBe('boltdocs-rehype-code-highlight')
  })

  it('filters only pre elements', () => {
    const plugin = satteriRehypeCodeHighlightPlugin() as {
      name: string
      element: { filter: string[] }
    }
    expect(plugin.element.filter).toEqual(['pre'])
  })

  it('returns an async visit function', () => {
    const plugin = satteriRehypeCodeHighlightPlugin() as {
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

    const plugin = satteriRehypeCodeHighlightPlugin() as {
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

    expect(mockAdapter.initialize).toHaveBeenCalledTimes(1)
    expect(mockAdapter.getOptions).toHaveBeenCalledWith('javascript', {})
    expect(mockAdapter.ensureLanguage).toHaveBeenCalledWith('javascript')
  })

  it('sets engine-agnostic data attributes on the highlighted pre', async () => {
    mockHighlighter.codeToHast.mockReturnValue({
      type: 'root',
      children: [
        {
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
        },
      ],
    })

    const plugin = satteriRehypeCodeHighlightPlugin() as {
      element: { filter: string[]; visit: (...args: unknown[]) => unknown }
    }

    const result = (await plugin.element.visit(
      {
        type: 'element',
        tagName: 'pre',
        properties: {},
        children: [
          {
            type: 'element',
            tagName: 'code',
            properties: {
              className: ['language-javascript'],
              metastring: 'lineNumbers',
            },
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
    )) as { properties: Record<string, unknown> }

    expect(result.properties['data-code-engine']).toBe('shiki')
    expect(result.properties['data-theme-mode']).toBe('single')
    expect(result.properties['data-highlighted']).toBe('true')
    expect(result.properties['data-lang']).toBe('javascript')
    expect(result.properties['data-line-numbers']).toBe('true')
  })

  it('returns shiki-fallback on highlight error', async () => {
    mockHighlighter.codeToHast.mockImplementation(() => {
      throw new Error('highlight error')
    })

    const plugin = satteriRehypeCodeHighlightPlugin() as {
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

  it('retries with plaintext when the language is not bundled', async () => {
    mockHighlighter.codeToHast
      .mockImplementationOnce(() => {
        throw new Error('Language `nginx` not found')
      })
      .mockImplementationOnce(() => ({
        type: 'root',
        children: [
          {
            type: 'element',
            tagName: 'pre',
            properties: {
              className: ['shiki', 'github-dark'],
              style: 'background-color:#24292e;color:#e1e4e8',
            },
            children: [
              {
                type: 'element',
                tagName: 'code',
                properties: {},
                children: [{ type: 'text', value: 'server { listen 80; }' }],
              },
            ],
          },
        ],
      }))

    const plugin = satteriRehypeCodeHighlightPlugin() as {
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
            properties: { className: ['language-nginx'] },
            children: [{ type: 'text', value: 'server { listen 80; }' }],
          },
        ],
      },
      {
        textContent: () => 'server { listen 80; }',
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

    expect(mockHighlighter.codeToHast).toHaveBeenCalledTimes(2)
    expect(mockHighlighter.codeToHast).toHaveBeenLastCalledWith(
      'server { listen 80; }',
      expect.objectContaining({ lang: 'plaintext' }),
    )

    const resultNode = result as { properties: Record<string, unknown> }
    expect(resultNode.properties['data-highlighted']).toBe('true')
    expect(resultNode.properties['data-lang']).toBe('nginx')
    expect(resultNode.properties.className).toEqual(
      expect.arrayContaining(['shiki']),
    )
  })

  it('skips non-code pre elements gracefully', async () => {
    mockHighlighter.codeToHast.mockClear()

    const plugin = satteriRehypeCodeHighlightPlugin() as {
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

    const plugin = satteriRehypeCodeHighlightPlugin() as {
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

  it('adapter config supports a custom engine id', () => {
    mockAdapter.name = 'prism'
    const plugin = satteriRehypeCodeHighlightPlugin({
      engine: 'prism',
    }) as {
      name: string
      element: { filter: string[] }
    }
    expect(plugin.name).toBe('boltdocs-rehype-code-highlight')
    mockAdapter.name = 'shiki'
  })

  describe('data-highlighted-html (single grammar pass + worker cache)', () => {
    const makeCtx = () => ({
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
    })

    const makePreNode = (code: string) => ({
      type: 'element' as const,
      tagName: 'pre',
      properties: {} as Record<string, unknown>,
      children: [
        {
          type: 'element' as const,
          tagName: 'code',
          properties: { className: ['language-javascript'] },
          children: [{ type: 'text' as const, value: code }],
        },
      ],
    })

    it('serializes data-highlighted-html from a single grammar pass', async () => {
      mockHighlighter.codeToHast.mockReturnValue({
        type: 'root',
        children: [
          {
            type: 'element',
            tagName: 'pre',
            properties: { className: ['shiki'] },
            children: [
              {
                type: 'element',
                tagName: 'code',
                properties: {},
                children: [
                  {
                    type: 'element',
                    tagName: 'span',
                    properties: { className: ['line'] },
                    children: [{ type: 'text', value: 'const single = 1' }],
                  },
                ],
              },
            ],
          },
        ],
      })

      const plugin = satteriRehypeCodeHighlightPlugin() as {
        element: { filter: string[]; visit: (...args: unknown[]) => unknown }
      }

      const result = (await plugin.element.visit(
        makePreNode('const single = 1'),
        makeCtx(),
      )) as { properties: Record<string, unknown> }

      expect(result.properties['data-highlighted']).toBe('true')
      expect(result.properties['data-highlighted-html']).toBe(
        '<pre class="shiki"><code><span class="line">const single = 1</span></code></pre>',
      )
      // The grammar runs once — no second codeToHtml pass.
      expect(mockHighlighter.codeToHast).toHaveBeenCalledTimes(1)
      expect(mockHighlighter.codeToHtml).not.toHaveBeenCalled()
    })

    it('serves identical (lang, options, code) from the worker cache', async () => {
      mockHighlighter.codeToHast.mockReturnValue({
        type: 'root',
        children: [
          {
            type: 'element',
            tagName: 'pre',
            properties: { className: ['shiki'] },
            children: [
              {
                type: 'element',
                tagName: 'code',
                properties: {},
                children: [{ type: 'text', value: 'const cacheProbe = 42' }],
              },
            ],
          },
        ],
      })

      const plugin = satteriRehypeCodeHighlightPlugin() as {
        element: { filter: string[]; visit: (...args: unknown[]) => unknown }
      }

      const first = (await plugin.element.visit(
        makePreNode('const cacheProbe = 42'),
        makeCtx(),
      )) as { properties: Record<string, unknown> }
      const second = (await plugin.element.visit(
        makePreNode('const cacheProbe = 42'),
        makeCtx(),
      )) as { properties: Record<string, unknown> }

      expect(mockHighlighter.codeToHast).toHaveBeenCalledTimes(1)
      expect(second.properties['data-highlighted-html']).toBe(
        first.properties['data-highlighted-html'],
      )
      expect(second.properties['data-highlighted']).toBe('true')
    })

    it('does not reuse the cache across different languages', async () => {
      mockHighlighter.codeToHast.mockReturnValue({
        type: 'root',
        children: [
          {
            type: 'element',
            tagName: 'pre',
            properties: { className: ['shiki'] },
            children: [
              {
                type: 'element',
                tagName: 'code',
                properties: {},
                children: [{ type: 'text', value: 'const langProbe = 7' }],
              },
            ],
          },
        ],
      })

      const plugin = satteriRehypeCodeHighlightPlugin() as {
        element: { filter: string[]; visit: (...args: unknown[]) => unknown }
      }

      const jsNode = makePreNode('const langProbe = 7')
      const pyNode = makePreNode('const langProbe = 7')
      ;(pyNode.children[0].properties as Record<string, unknown>).className = [
        'language-python',
      ]

      await plugin.element.visit(jsNode, makeCtx())
      await plugin.element.visit(pyNode, makeCtx())

      expect(mockHighlighter.codeToHast).toHaveBeenCalledTimes(2)
    })

    it('preserves indentation whitespace in data-highlighted-html', async () => {
      const indentedCode =
        'function hello() {\n  return {\n    greeting: "hi",\n  }\n}'
      const shikiHtml =
        '<pre class="shiki"><code>' +
        '<span class="line"><span>function</span> <span>hello</span>() {</span>\n' +
        '<span class="line">  <span>return</span> {</span>\n' +
        '<span class="line">    greeting: <span>"hi"</span>,</span>\n' +
        '<span class="line">  }</span>\n' +
        '<span class="line">}</span>' +
        '</code></pre>'

      mockHighlighter.codeToHast.mockReturnValue({
        type: 'root',
        children: [
          {
            type: 'element',
            tagName: 'pre',
            properties: { className: ['shiki'] },
            children: [
              {
                type: 'element',
                tagName: 'code',
                properties: {},
                children: [{ type: 'text', value: indentedCode }],
              },
            ],
          },
        ],
      })
      mockHighlighter.codeToHtml.mockResolvedValue(shikiHtml)

      const plugin = satteriRehypeCodeHighlightPlugin() as {
        element: { filter: string[]; visit: (...args: unknown[]) => unknown }
      }

      const result = (await plugin.element.visit(
        makePreNode(indentedCode),
        makeCtx(),
      )) as { properties: Record<string, unknown> }

      const html = result.properties['data-highlighted-html'] as string
      expect(html).toBeDefined()
      // Serialization preserves the raw text node content, indentation included
      expect(html).toContain('\n  return {')
      expect(html).toContain('\n    greeting: "hi",')
      expect(html).toContain('\n  }')
    })
  })
})
