import { beforeEach, describe, expect, it, vi } from 'vitest'
import pagefindSearchPlugin from '../src/node/index'

const spawn = vi.hoisted(() => vi.fn())

vi.mock('node:child_process', () => ({ spawn }))

function fakeChild(code: number | null = 0) {
  const handlers: Record<string, (arg: unknown) => void> = {}
  return {
    on(event: string, handler: (arg: unknown) => void) {
      handlers[event] = handler
      // Pagefind is short-lived: `close` follows `spawn` synchronously in the
      // test so the plugin's promise resolves without a real process.
      if (event === 'close') queueMicrotask(() => handler(code))
      return this
    },
  }
}

function ctx(outDir?: string) {
  return {
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    config: outDir ? { outDir } : {},
    outDir,
    store: { get: vi.fn(), set: vi.fn(), has: vi.fn(), delete: vi.fn() },
    meta: { name: 'test', version: '1' },
    docsDir: '/p/docs',
    rootDir: '/p',
    routes: [],
  } as never
}

describe('pagefind plugin', () => {
  // `spawn` is module-level and every case replaces its return value, so the
  // call history has to be cleared between them: without this, "was spawn
  // called?" passes on a call made by an earlier test.
  beforeEach(() => {
    spawn.mockReset()
    spawn.mockReturnValue(fakeChild(0))
  })

  it('indexes the output directory after the render', async () => {
    const plugin = pagefindSearchPlugin({ binaryPath: '/bin/pagefind' })

    await plugin.hooks?.['build:generate']?.(ctx('/p/dist'))

    expect(spawn).toHaveBeenCalledTimes(1)
    const [binary, args] = spawn.mock.calls[0]
    expect(binary).toBe('/bin/pagefind')
    // The output directory is the last argument: Pagefind reads the site from
    // positional input, not from a flag.
    expect(args.at(-1)).toBe('/p/dist')
  })

  it('runs in the output directory so relative paths resolve', async () => {
    const plugin = pagefindSearchPlugin({ binaryPath: '/bin/pagefind' })

    await plugin.hooks?.['build:generate']?.(ctx('/p/dist'))

    expect(spawn.mock.calls[0][2].cwd).toBe('/p/dist')
  })

  it('uses the default site key', async () => {
    const plugin = pagefindSearchPlugin({ binaryPath: '/bin/pagefind' })

    await plugin.hooks?.['build:generate']?.(ctx('/p/dist'))

    expect(spawn.mock.calls[0][1]).toContain('--site-key')
    expect(spawn.mock.calls[0][1]).toContain('boltdocs')
  })

  it('honours a custom site key', async () => {
    const plugin = pagefindSearchPlugin({
      binaryPath: '/bin/pagefind',
      siteKey: 'my-docs',
    })

    await plugin.hooks?.['build:generate']?.(ctx('/p/dist'))

    expect(spawn.mock.calls[0][1]).toContain('my-docs')
  })

  it('passes exclude patterns through', async () => {
    const plugin = pagefindSearchPlugin({
      binaryPath: '/bin/pagefind',
      excludePatterns: ['changelog', '/es/'],
    })

    await plugin.hooks?.['build:generate']?.(ctx('/p/dist'))

    const args: string[] = spawn.mock.calls[0][1]
    expect(args).toContain('changelog')
    expect(args).toContain('/es/')
  })

  it('warns and does not throw when the build context has no output dir', async () => {
    const plugin = pagefindSearchPlugin({ binaryPath: '/bin/pagefind' })
    const context = ctx(undefined)

    await expect(
      plugin.hooks?.['build:generate']?.(context),
    ).resolves.toBeUndefined()
    expect(spawn).not.toHaveBeenCalled()
  })

  it('warns and does not throw when the binary is missing', async () => {
    // A site whose install skipped optional dependencies should still build.
    // Failing the deploy over a missing search index would be the wrong
    // trade: every page renders, only search is absent.
    const plugin = pagefindSearchPlugin({
      binaryPath: '/definitely/not/here/pagefind',
    })
    const context = ctx('/p/dist')

    await expect(
      plugin.hooks?.['build:generate']?.(context),
    ).resolves.toBeUndefined()
  })

  it('does not contribute search.json entries', async () => {
    // Pagefind owns its own index. Publishing the runtime asset alongside it
    // would ship a file no configured client reads.
    const plugin = pagefindSearchPlugin({ binaryPath: '/bin/pagefind' })
    expect(plugin.hooks?.['search:index']).toBeUndefined()
  })
})
