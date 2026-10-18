import fs from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BoltdocsPlugin, RouteMeta } from 'boltdocs'
import { clearGitHistoryCache } from '../src/node/git'
import { lastUpdatedPlugin } from '../src/node/index'
import {
  createGitRepo,
  createPlainDir,
  removeDir,
  type FixtureRepo,
} from './helpers/git-repo'

let repo: FixtureRepo

function makeContext(docsDir: string) {
  return {
    docsDir,
    config: {},
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  } as any
}

async function runPlugin(
  plugin: BoltdocsPlugin,
  routes: RouteMeta[],
  docsDir: string,
): Promise<RouteMeta[]> {
  const hook = plugin.hooks?.['routes:resolved']
  if (!hook) throw new Error('routes:resolved hook missing')
  const result = await hook(makeContext(docsDir), { routes })
  return (result as RouteMeta[]) ?? routes
}

beforeEach(async () => {
  clearGitHistoryCache()
  repo = await createGitRepo([
    {
      author: 'Alice',
      email: 'alice@example.com',
      date: '2026-01-01T10:00:00Z',
      files: { 'docs/guide.md': '# Guide\n' },
    },
    {
      author: 'Bob',
      email: 'bob@example.com',
      date: '2026-02-15T10:00:00Z',
      files: { 'docs/guide.md': '# Guide\n\nUpdated.\n' },
    },
  ])
})

afterEach(async () => {
  clearGitHistoryCache()
  await removeDir(repo.root)
})

function guideRoute(overrides: Partial<RouteMeta> = {}): RouteMeta {
  return {
    path: '/docs/guide',
    componentPath: path.join(repo.docsDir, 'guide.md'),
    filePath: 'guide.md',
    title: 'Guide',
    frontmatter: {},
    ...overrides,
  } as RouteMeta
}

describe('lastUpdatedPlugin', () => {
  it('uses the latest git commit date', async () => {
    const routes = await runPlugin(
      lastUpdatedPlugin(),
      [guideRoute()],
      repo.docsDir,
    )
    expect(routes[0].lastUpdated).toBe('2026-02-15T10:00:00.000Z')
  })

  it('keeps an explicit string frontmatter date', async () => {
    const date = '2025-12-24T00:00:00.000Z'
    const routes = await runPlugin(
      lastUpdatedPlugin(),
      [
        guideRoute({
          lastUpdated: date,
          frontmatter: { lastUpdated: date },
        }),
      ],
      repo.docsDir,
    )
    expect(routes[0].lastUpdated).toBe(date)
  })

  it('overrides frontmatter when overrideFrontmatter is enabled', async () => {
    const routes = await runPlugin(
      lastUpdatedPlugin({ overrideFrontmatter: true }),
      [guideRoute({ frontmatter: { lastUpdated: '2025-12-24' } })],
      repo.docsDir,
    )
    expect(routes[0].lastUpdated).toBe('2026-02-15T10:00:00.000Z')
  })

  it('replaces the numeric mtime fallback injected by the core', async () => {
    const routes = await runPlugin(
      lastUpdatedPlugin(),
      [guideRoute({ frontmatter: { lastUpdated: 1700000000000 } })],
      repo.docsDir,
    )
    expect(routes[0].lastUpdated).toBe('2026-02-15T10:00:00.000Z')
  })

  it('honours paths and excludePaths', async () => {
    const routes = await runPlugin(
      lastUpdatedPlugin({ paths: ['/blog'] }),
      [guideRoute()],
      repo.docsDir,
    )
    expect(routes[0].lastUpdated).toBeUndefined()

    const excluded = await runPlugin(
      lastUpdatedPlugin({ excludePaths: ['/docs/guide'] }),
      [guideRoute()],
      repo.docsDir,
    )
    expect(excluded[0].lastUpdated).toBeUndefined()
  })

  it('falls back to the file mtime for untracked files when enabled', async () => {
    const untracked = path.join(repo.docsDir, 'new-page.md')
    await fs.writeFile(untracked, '# New\n')

    const route = guideRoute({
      path: '/docs/new-page',
      componentPath: untracked,
      filePath: 'new-page.md',
    })

    const withoutFallback = await runPlugin(
      lastUpdatedPlugin(),
      [route],
      repo.docsDir,
    )
    expect(withoutFallback[0].lastUpdated).toBeUndefined()

    const withFallback = await runPlugin(
      lastUpdatedPlugin({ fallbackToMtime: true }),
      [route],
      repo.docsDir,
    )
    expect(typeof withFallback[0].lastUpdated).toBe('string')
    expect(
      Number.isNaN(new Date(withFallback[0].lastUpdated as string).getTime()),
    ).toBe(false)
  })

  it('leaves routes untouched outside a git repository', async () => {
    const plainDir = await createPlainDir()
    try {
      const route: RouteMeta = {
        path: '/docs/page',
        componentPath: path.join(plainDir, 'page.md'),
        filePath: 'page.md',
        title: 'Page',
        frontmatter: {},
      } as RouteMeta
      const routes = await runPlugin(lastUpdatedPlugin(), [route], plainDir)
      expect(routes[0].lastUpdated).toBeUndefined()
    } finally {
      await removeDir(plainDir)
    }
  })
})
