import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

// The real satteri processor pulls in esbuild, which fails an invariant in
// some environments. Mock it like the existing HMR tests do.
vi.mock('@bdocs/processor-satteri/node', () => ({
  invalidateMdxFileCache: vi.fn(),
}))

import { configureWatcher } from '../src/node/dev-server/watcher'
import { createHotUpdateHandler } from '../src/node/dev-server/hmr-handler'

describe('configureWatcher', () => {
  it('does not explicitly add paths inside the Vite root', () => {
    // Config paths resolve against process.cwd(), which matches the root in
    // real CLI usage.
    const root = process.cwd()
    const docsDir = path.join(root, 'docs')
    const add = vi.fn()
    const server = { config: { root }, watcher: { add } } as never

    configureWatcher(server, docsDir)

    expect(add).not.toHaveBeenCalled()
  })

  it('explicitly adds paths that live outside the Vite root', () => {
    const root = path.resolve('/project')
    const docsDir = path.resolve('/external/docs')
    const add = vi.fn()
    const server = { config: { root }, watcher: { add } } as never

    configureWatcher(server, docsDir)

    expect(add).toHaveBeenCalledTimes(1)
    const added = (add.mock.calls[0] as [string[]])[0]
    expect(added.length).toBeGreaterThan(0)
    expect(added.every((p) => !p.startsWith(`${root}${path.sep}`))).toBe(true)
    // The pages-external index variants are only watched when out-of-root,
    // so they never poison the in-root recursive scan.
    expect(
      added.some((p) => p.includes(path.join('pages-external', 'index'))),
    ).toBe(true)
  })
})

describe('createHotUpdateHandler', () => {
  it('suppresses default HMR for pages-external files', () => {
    const handler = createHotUpdateHandler('/project/docs')

    expect(
      handler?.({
        file: '/project/docs/pages-external/roadmap.mdx',
      } as never),
    ).toEqual([])
    expect(
      handler?.({
        file: '/project/docs/pages-external/_sections/home-page.tsx',
      } as never),
    ).toEqual([])
    expect(
      handler?.({
        file: '/project/docs/pages-external/index.tsx',
      } as never),
    ).toEqual([])
  })

  it('does not suppress HMR for files outside pages-external', () => {
    const handler = createHotUpdateHandler('/project/docs')

    expect(
      handler?.({
        file: '/project/docs/src/components/home-page.tsx',
      } as never),
    ).toBe(undefined)
    expect(
      handler?.({
        file: '/project/docs/pages-external-other/page.tsx',
      } as never),
    ).toBe(undefined)
  })
})
