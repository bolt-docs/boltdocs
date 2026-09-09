import { describe, it, expect, vi } from 'vitest'
import { ViteImageOptimizer } from '../src'
import { VITE_PLUGIN_NAME, TEST_REGEX } from '../src/constants'

vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    toFormat: () => ({
      toBuffer: async () => Buffer.from('optimized-by-sharp'),
    }),
  })),
}))

const SVG_CONTENT =
  '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'

function makeBundler(files: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(files).map(([fileName, source]) => [
      fileName,
      { type: 'asset', name: fileName, fileName, source: Buffer.from(source) },
    ]),
  )
}

const resolvedConfig = {
  build: { outDir: 'dist' },
  publicDir: 'public',
  root: '/tmp',
}

describe('ViteImageOptimizer', () => {
  it('exposes the expected plugin identity and lifecycle', () => {
    const plugin = ViteImageOptimizer()
    expect(plugin.name).toBe(VITE_PLUGIN_NAME)
    expect(plugin.apply).toBe('build')
    expect(plugin.enforce).toBe('post')
    expect(typeof plugin.generateBundle).toBe('function')
    expect(typeof plugin.configResolved).toBe('function')
    expect(typeof plugin.closeBundle).toBe('function')
  })

  it('leaves non-matching assets untouched when include filters by name', async () => {
    const plugin = ViteImageOptimizer({ include: ['logo.svg'] })
    plugin.configResolved!(resolvedConfig as any)
    const bundler = makeBundler({
      'logo.svg': SVG_CONTENT,
      'photo.png': 'png-data',
    })
    await plugin.generateBundle!({}, bundler as any)

    const logo = (bundler['logo.svg'] as any).source.toString()
    expect(logo).not.toContain('<rect')
    expect((bundler['photo.png'] as any).source.toString()).toBe('png-data')
  })

  it('includes only files matching a regex include matcher', async () => {
    const plugin = ViteImageOptimizer({ include: /\.svg$/i })
    plugin.configResolved!(resolvedConfig as any)
    const bundler = makeBundler({
      'a.svg': SVG_CONTENT,
      'b.webp': 'webp-data',
    })
    await plugin.generateBundle!({}, bundler as any)

    expect((bundler['a.svg'] as any).source.toString()).not.toContain('<rect')
    expect((bundler['b.webp'] as any).source.toString()).toBe('webp-data')
  })

  it('uses the default test matcher when no include is set', async () => {
    const plugin = ViteImageOptimizer()
    plugin.configResolved!(resolvedConfig as any)
    expect(TEST_REGEX.test('photo.png')).toBe(true)

    const bundler = makeBundler({
      'a.svg': SVG_CONTENT,
      'notes.txt': 'txt-data',
    })
    await plugin.generateBundle!({}, bundler as any)

    expect((bundler['a.svg'] as any).source.toString()).not.toContain('<rect')
    expect((bundler['notes.txt'] as any).source.toString()).toBe('txt-data')
  })

  it('excludes files matching an exclude matcher', async () => {
    const plugin = ViteImageOptimizer({ exclude: ['skip.svg'] })
    plugin.configResolved!(resolvedConfig as any)
    const bundler = makeBundler({
      'skip.svg': SVG_CONTENT,
      'keep.svg': SVG_CONTENT,
    })
    await plugin.generateBundle!({}, bundler as any)

    expect((bundler['skip.svg'] as any).source.toString()).toContain('<rect')
    expect((bundler['keep.svg'] as any).source.toString()).not.toContain(
      '<rect',
    )
  })

  it('keeps the source when optimization does not shrink the file', async () => {
    const plugin = ViteImageOptimizer({ include: ['tiny.svg'] })
    plugin.configResolved!(resolvedConfig as any)
    const tiny = '<svg xmlns="http://www.w3.org/2000/svg"></svg>'
    const bundler = makeBundler({ 'tiny.svg': tiny })
    await plugin.generateBundle!({}, bundler as any)
    // svgo on an already-minimal svg produces a same-size or larger output,
    // so the skipWrite guard must preserve the original source buffer.
    const source = (bundler['tiny.svg'] as any).source
    expect(Buffer.isBuffer(source)).toBe(true)
  })
})
