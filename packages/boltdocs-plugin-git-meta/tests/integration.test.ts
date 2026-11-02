import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BoltdocsPlugin, RouteMeta } from 'boltdocs'
import { clearGitHistoryCache } from '../src/node/git'
import { contributorsPlugin, lastUpdatedPlugin } from '../src/node/index'
import { createGitRepo, removeDir, type FixtureRepo } from './helpers/git-repo'

let repo: FixtureRepo

beforeEach(async () => {
  clearGitHistoryCache()
  repo = await createGitRepo([
    {
      author: 'Alice',
      email: '12345+alice@users.noreply.github.com',
      date: '2026-01-01T10:00:00Z',
      files: { 'docs/guide.md': '# Guide\n' },
    },
    {
      author: 'Bob',
      email: 'bob@example.com',
      date: '2026-02-01T10:00:00Z',
      files: { 'docs/guide.md': '# Guide\n\nUpdated.\n' },
    },
  ])
})

afterEach(async () => {
  clearGitHistoryCache()
  await removeDir(repo.root)
})

describe('git metadata plugins together', () => {
  it('enriches lastUpdated and contributors on the same route', async () => {
    const ctx = {
      docsDir: repo.docsDir,
      config: {},
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
    } as any

    let routes: RouteMeta[] = [
      {
        path: '/docs/guide',
        componentPath: path.join(repo.docsDir, 'guide.md'),
        filePath: 'guide.md',
        title: 'Guide',
        frontmatter: {},
      } as RouteMeta,
    ]

    for (const plugin of [
      lastUpdatedPlugin(),
      contributorsPlugin({ max: 5 }),
    ] as BoltdocsPlugin[]) {
      const hook = plugin.hooks?.['routes:resolved']
      if (!hook) throw new Error('routes:resolved hook missing')
      routes = ((await hook(ctx, { routes })) as RouteMeta[]) ?? routes
    }

    expect(routes[0].lastUpdated).toBe('2026-02-01T10:00:00.000Z')
    expect(routes[0].contributors).toEqual([
      expect.objectContaining({
        name: 'Bob',
        commits: 1,
      }),
      expect.objectContaining({
        name: 'Alice',
        avatar: 'https://github.com/alice.png?size=64',
        commits: 1,
      }),
    ])

    // Route metadata crosses the SSG → client boundary as JSON.
    expect(() => JSON.stringify(routes)).not.toThrow()
  })
})
