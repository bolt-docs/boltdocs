import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BoltdocsPlugin, RouteMeta } from 'boltdocs'
import { clearGitHistoryCache } from '../src/node/git'
import { contributorsPlugin } from '../src/node/index'
import {
  createGitRepo,
  createPlainDir,
  removeDir,
  type FixtureCommit,
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

async function createContributorRepo(
  extraCommits: FixtureCommit[] = [],
): Promise<FixtureRepo> {
  return createGitRepo([
    {
      author: 'Alice',
      email: 'alice@example.com',
      date: '2026-01-01T10:00:00Z',
      files: { 'docs/guide.md': '# Guide\n' },
    },
    {
      author: 'Alice',
      email: 'alice@example.com',
      date: '2026-01-02T10:00:00Z',
      files: { 'docs/guide.md': '# Guide\n\nOne.\n' },
    },
    {
      author: 'Bob',
      email: '12345+bob@users.noreply.github.com',
      date: '2026-01-03T10:00:00Z',
      files: { 'docs/guide.md': '# Guide\n\nTwo.\n' },
    },
    ...extraCommits,
  ])
}

beforeEach(async () => {
  clearGitHistoryCache()
  repo = await createContributorRepo([
    {
      author: 'dependabot[bot]',
      email: '49699333+dependabot[bot]@users.noreply.github.com',
      date: '2026-01-04T10:00:00Z',
      files: { 'docs/guide.md': '# Guide\n\nBot.\n' },
    },
  ])
})

afterEach(async () => {
  clearGitHistoryCache()
  await removeDir(repo.root)
})

describe('contributorsPlugin', () => {
  it('ranks contributors by commits and hides emails by default', async () => {
    const routes = await runPlugin(
      contributorsPlugin(),
      [guideRoute()],
      repo.docsDir,
    )

    expect(routes[0].contributors).toEqual([
      expect.objectContaining({
        name: 'Alice',
        commits: 2,
      }),
      expect.objectContaining({
        name: 'Bob',
        commits: 1,
      }),
    ])
    expect(routes[0].contributors?.every((c) => !('email' in c))).toBe(true)
  })

  it('derives avatars and profile URLs from GitHub noreply emails', async () => {
    const routes = await runPlugin(
      contributorsPlugin(),
      [guideRoute()],
      repo.docsDir,
    )
    const bob = routes[0].contributors?.find(
      (contributor) => contributor.name === 'Bob',
    )
    expect(bob?.avatar).toBe('https://github.com/bob.png?size=64')
    expect(bob?.url).toBe('https://github.com/bob')
  })

  it('applies profile overrides keyed by email', async () => {
    const routes = await runPlugin(
      contributorsPlugin({
        profiles: {
          'alice@example.com': {
            name: 'Alice Doe',
            avatar: 'https://example.com/alice.png',
            url: 'https://example.com/alice',
          },
        },
      }),
      [guideRoute()],
      repo.docsDir,
    )

    expect(routes[0].contributors?.[0]).toMatchObject({
      name: 'Alice Doe',
      avatar: 'https://example.com/alice.png',
      url: 'https://example.com/alice',
      commits: 2,
    })
  })

  it('excludes bots and configured authors', async () => {
    const routes = await runPlugin(
      contributorsPlugin({ excludeAuthors: ['Bob'] }),
      [guideRoute()],
      repo.docsDir,
    )
    expect(routes[0].contributors?.map((c) => c.name)).toEqual(['Alice'])
  })

  it('keeps bots when excludeBots is disabled', async () => {
    const routes = await runPlugin(
      contributorsPlugin({ excludeBots: false }),
      [guideRoute()],
      repo.docsDir,
    )
    expect(
      routes[0].contributors?.some((c) => c.name === 'dependabot[bot]'),
    ).toBe(true)
  })

  it('merges identities that share a display name', async () => {
    const aliasRepo = await createContributorRepo([
      {
        author: 'Alice',
        email: 'alice@work.example',
        date: '2026-01-04T10:00:00Z',
        files: { 'docs/guide.md': '# Guide\n\nWork.\n' },
      },
    ])
    try {
      const routes = await runPlugin(
        contributorsPlugin(),
        [
          guideRoute({
            componentPath: path.join(aliasRepo.docsDir, 'guide.md'),
          }),
        ],
        aliasRepo.docsDir,
      )
      const alice = routes[0].contributors?.find(
        (contributor) => contributor.name === 'Alice',
      )
      expect(alice?.commits).toBe(3)
      expect(routes[0].contributors).toHaveLength(2)
    } finally {
      await removeDir(aliasRepo.root)
    }
  })

  it('honours max and recent ordering', async () => {
    const routes = await runPlugin(
      contributorsPlugin({ max: 1, order: 'recent' }),
      [guideRoute()],
      repo.docsDir,
    )
    expect(routes[0].contributors).toHaveLength(1)
    expect(routes[0].contributors?.[0].name).toBe('Bob')
  })

  it('includes emails only when requested', async () => {
    const routes = await runPlugin(
      contributorsPlugin({ includeEmail: true }),
      [guideRoute()],
      repo.docsDir,
    )
    expect(routes[0].contributors?.[0].email).toBe('alice@example.com')
  })

  it('honours paths filters', async () => {
    const routes = await runPlugin(
      contributorsPlugin({ paths: ['/blog'] }),
      [guideRoute()],
      repo.docsDir,
    )
    expect(routes[0].contributors).toBeUndefined()
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
      const routes = await runPlugin(contributorsPlugin(), [route], plainDir)
      expect(routes[0].contributors).toBeUndefined()
    } finally {
      await removeDir(plainDir)
    }
  })
})
