import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import mermaidPlugin from '../src/node/index'

vi.mock('../src/node/render', () => ({
  renderMermaidBothThemes: vi.fn(),
}))

vi.mock('@bdocs/dui', () => ({
  warn: vi.fn(),
}))

import { renderMermaidBothThemes } from '../src/node/render'
import { warn } from '@bdocs/dui'

const mermaidBlock = {
  type: 'code',
  lang: 'mermaid',
  value: 'graph TD\n  A --> B',
}

function buildTree(block: unknown = mermaidBlock) {
  return { type: 'root', children: [block] }
}

function extractPluginTransform() {
  const plugin = mermaidPlugin()
  const pluginEntry = plugin.remarkPlugins?.[0]
  const [factory, config] = pluginEntry as any
  return factory(config)
}

describe('mermaidPlugin pre-render branch', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalCi = process.env.CI
  const originalSkip = process.env.BOLTDOCS_SKIP_MERMAID

  beforeEach(() => {
    vi.mocked(renderMermaidBothThemes).mockReset()
    vi.mocked(warn).mockReset()
    process.env.NODE_ENV = 'test'
    delete process.env.CI
    delete process.env.BOLTDOCS_SKIP_MERMAID
  })

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
    if (originalCi === undefined) delete process.env.CI
    else process.env.CI = originalCi
    if (originalSkip === undefined) delete process.env.BOLTDOCS_SKIP_MERMAID
    else process.env.BOLTDOCS_SKIP_MERMAID = originalSkip
  })

  it('attaches pre-rendered SVG attributes when rendering succeeds', async () => {
    vi.mocked(renderMermaidBothThemes).mockResolvedValue({
      svgLight: '<svg data-theme="light"></svg>',
      svgDark: '<svg data-theme="dark"></svg>',
    })

    const transform = extractPluginTransform()
    const tree = buildTree()
    await transform(tree)

    expect(renderMermaidBothThemes).toHaveBeenCalledTimes(1)
    expect(renderMermaidBothThemes).toHaveBeenCalledWith(
      'graph TD\n  A --> B',
      expect.objectContaining({ primaryColor: '#f8fafc' }),
      expect.objectContaining({ primaryColor: '#1e293b' }),
    )

    const el = tree.children[0]
    expect(el.type).toBe('mdxJsxFlowElement')
    expect(el.name).toBe('Mermaid')
    const attrs = Object.fromEntries(
      el.attributes.map((a: any) => [a.name, a.value]),
    )
    expect(attrs).toEqual({
      chart: 'graph TD\n  A --> B',
      config: expect.any(String),
      svgLight: '<svg data-theme="light"></svg>',
      svgDark: '<svg data-theme="dark"></svg>',
    })
    expect(JSON.parse(attrs.config).themes.light.primaryColor).toBe('#f8fafc')
    expect(JSON.parse(attrs.config).themes.dark.primaryColor).toBe('#1e293b')
  })

  it('warns and omits SVG attributes when pre-rendering fails', async () => {
    vi.mocked(renderMermaidBothThemes).mockResolvedValue({
      error: 'Parse error: Unexpected token',
    })

    const transform = extractPluginTransform()
    const tree = buildTree()
    await transform(tree)

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to pre-render Mermaid diagram'),
    )
    const el = tree.children[0] as any
    const names = el.attributes.map((a: any) => a.name)
    expect(names).toEqual(['chart', 'config'])
    expect(names).not.toContain('svgLight')
    expect(names).not.toContain('svgDark')
  })

  it('skips pre-rendering when the plugin option preRender is false', async () => {
    const plugin = mermaidPlugin({ preRender: false })
    const pluginEntry = plugin.remarkPlugins?.[0]
    const [factory, config] = pluginEntry as any
    const transform = factory(config)
    const tree = buildTree()
    await transform(tree)

    expect(renderMermaidBothThemes).not.toHaveBeenCalled()
    const names = tree.children[0].attributes.map((a: any) => a.name)
    expect(names).toEqual(['chart', 'config'])
  })

  it('skips pre-rendering when BOLTDOCS_SKIP_MERMAID is true', async () => {
    process.env.BOLTDOCS_SKIP_MERMAID = 'true'
    const transform = extractPluginTransform()
    const tree = buildTree()
    await transform(tree)

    expect(renderMermaidBothThemes).not.toHaveBeenCalled()
    const names = tree.children[0].attributes.map((a: any) => a.name)
    expect(names).toEqual(['chart', 'config'])
  })

  it('leaves non-mermaid code blocks untouched', async () => {
    const transform = extractPluginTransform()
    const tree = buildTree({
      type: 'code',
      lang: 'ts',
      value: 'const x = 1',
    })
    await transform(tree)

    expect(renderMermaidBothThemes).not.toHaveBeenCalled()
    expect(tree.children[0].type).toBe('code')
    expect(tree.children[0].lang).toBe('ts')
  })

  it('uses custom theme variables in the config attribute', async () => {
    vi.mocked(renderMermaidBothThemes).mockResolvedValue({
      svgLight: '<svg>l</svg>',
      svgDark: '<svg>d</svg>',
    })
    const plugin = mermaidPlugin({
      themes: {
        light: { primaryColor: '#ff0000' },
        dark: { primaryColor: '#00ff00' },
      },
    })
    const pluginEntry = plugin.remarkPlugins?.[0]
    const [factory, config] = pluginEntry as any
    const transform = factory(config)
    const tree = buildTree()
    await transform(tree)

    const configAttr = tree.children[0].attributes.find(
      (a: any) => a.name === 'config',
    )
    const parsed = JSON.parse(configAttr.value)
    expect(parsed.themes.light.primaryColor).toBe('#ff0000')
    expect(parsed.themes.dark.primaryColor).toBe('#00ff00')
    expect(parsed.themes.light.primaryTextColor).toBe('#0f172a')
  })
})
