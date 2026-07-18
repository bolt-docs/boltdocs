import { describe, it, expect, vi, beforeEach } from 'vitest'
import { collectUserPlugins } from '../node/user-plugins'
import {
  wrapRemarkPlugin,
  wrapRemarkCodePlugin,
} from '../node/satteri-plugins/remark-adapter'
import { wrapHastPlugin } from '../node/satteri-plugins/rehype-adapter'

vi.mock('../node/satteri-plugins/remark-adapter', () => ({
  wrapRemarkPlugin: vi.fn(),
  wrapRemarkCodePlugin: vi.fn(),
}))

vi.mock('../node/satteri-plugins/rehype-adapter', () => ({
  wrapHastPlugin: vi.fn(),
}))

describe('collectUserPlugins', () => {
  beforeEach(() => {
    vi.mocked(wrapRemarkPlugin).mockReset()
    vi.mocked(wrapRemarkCodePlugin).mockReset()
    vi.mocked(wrapHastPlugin).mockReset()
  })

  it('returns empty collections for undefined config', () => {
    const result = collectUserPlugins(undefined)
    expect(result).toEqual({ remarkPlugins: [], rehypePlugins: [] })
  })

  it('returns empty collections for config with no plugins', () => {
    const result = collectUserPlugins({ plugins: [] } as never)
    expect(result).toEqual({ remarkPlugins: [], rehypePlugins: [] })
  })

  it('collects remark plugins from config', () => {
    const remarkFn = () => vi.fn()
    vi.mocked(wrapRemarkPlugin).mockReturnValue({
      name: 'wrapped-remark',
    } as never)
    const result = collectUserPlugins({
      plugins: [
        {
          name: 'test-plugin',
          remarkPlugins: [remarkFn],
        },
      ],
    } as never)
    expect(wrapRemarkPlugin).toHaveBeenCalledTimes(1)
    expect(result.remarkPlugins).toHaveLength(1)
  })

  it('collects remark plugins in [fn, opts] tuple format', () => {
    const remarkFn = () => vi.fn()
    vi.mocked(wrapRemarkPlugin).mockReturnValue({
      name: 'wrapped-remark',
    } as never)
    const result = collectUserPlugins({
      plugins: [
        {
          name: 'test-plugin',
          remarkPlugins: [[remarkFn, { option: true }]],
        },
      ],
    } as never)
    expect(wrapRemarkPlugin).toHaveBeenCalledTimes(1)
    expect(result.remarkPlugins).toHaveLength(1)
  })

  it('uses wrapRemarkCodePlugin for mermaid plugin', () => {
    const mermaidFn = () => vi.fn()
    vi.mocked(wrapRemarkCodePlugin).mockReturnValue({
      name: 'wrapped-mermaid',
    } as never)
    const result = collectUserPlugins({
      plugins: [
        {
          name: 'boltdocs-plugin-mermaid',
          remarkPlugins: [[mermaidFn, { theme: 'dark' }]],
        },
      ],
    } as never)
    expect(wrapRemarkCodePlugin).toHaveBeenCalledWith(
      mermaidFn,
      { theme: 'dark' },
      'Mermaid',
      'mermaid',
    )
    expect(result.remarkPlugins).toHaveLength(1)
  })

  it('collects rehype plugins in direct format', () => {
    const rehypeFn = () => vi.fn()
    vi.mocked(wrapHastPlugin).mockReturnValue({
      name: 'wrapped-rehype',
    } as never)
    const result = collectUserPlugins({
      plugins: [
        {
          name: 'test-plugin',
          rehypePlugins: [rehypeFn],
        },
      ],
    } as never)
    expect(wrapHastPlugin).toHaveBeenCalledTimes(1)
    expect(result.rehypePlugins).toHaveLength(1)
  })

  it('collects rehype plugins in [fn, opts] tuple format', () => {
    const rehypeFn = () => vi.fn()
    vi.mocked(wrapHastPlugin).mockReturnValue({
      name: 'wrapped-rehype',
    } as never)
    const result = collectUserPlugins({
      plugins: [
        {
          name: 'test-plugin',
          rehypePlugins: [[rehypeFn, { option: true }]],
        },
      ],
    } as never)
    expect(wrapHastPlugin).toHaveBeenCalledTimes(1)
    expect(result.rehypePlugins).toHaveLength(1)
  })

  it('skips rehype plugins that fail to wrap', () => {
    const rehypeFn = () => vi.fn()
    vi.mocked(wrapHastPlugin).mockReturnValue(null)
    const result = collectUserPlugins({
      plugins: [
        {
          name: 'test-plugin',
          rehypePlugins: [rehypeFn],
        },
      ],
    } as never)
    expect(wrapHastPlugin).toHaveBeenCalledTimes(1)
    expect(result.rehypePlugins).toHaveLength(0)
  })

  it('handles multiple plugins with mixed remark/rehype', () => {
    vi.mocked(wrapRemarkPlugin).mockReturnValue({
      name: 'wrapped-remark',
    } as never)
    vi.mocked(wrapHastPlugin).mockReturnValue({
      name: 'wrapped-rehype',
    } as never)
    const result = collectUserPlugins({
      plugins: [
        {
          name: 'plugin-a',
          remarkPlugins: [() => vi.fn()],
          rehypePlugins: [() => vi.fn()],
        },
        {
          name: 'plugin-b',
          remarkPlugins: [() => vi.fn()],
        },
      ],
    } as never)
    expect(wrapRemarkPlugin).toHaveBeenCalledTimes(2)
    expect(wrapHastPlugin).toHaveBeenCalledTimes(1)
    expect(result.remarkPlugins).toHaveLength(2)
    expect(result.rehypePlugins).toHaveLength(1)
  })
})
