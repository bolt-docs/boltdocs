import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  clearGitHistoryCache,
  getGitHistory,
  parseGitLog,
} from '../src/node/git'
import {
  createGitRepo,
  createPlainDir,
  removeDir,
  type FixtureRepo,
} from './helpers/git-repo'

let repo: FixtureRepo

beforeEach(async () => {
  clearGitHistoryCache()
  repo = await createGitRepo([
    {
      author: 'Alice',
      email: 'alice@example.com',
      date: '2026-01-01T10:00:00Z',
      files: {
        'docs/guide.md': '# Guide\n',
        'docs/image.png': 'not-markdown',
      },
    },
    {
      author: 'Bob',
      email: 'bob@example.com',
      date: '2026-01-02T10:00:00Z',
      files: { 'docs/guide.md': '# Guide\n\nUpdated.\n' },
    },
    {
      author: 'Alice',
      email: 'alice@example.com',
      date: '2026-01-03T10:00:00Z',
      files: {
        'docs/guide.md': '# Guide\n\nUpdated again.\n',
        'docs/es/guide.mdx': '# Guía\n',
      },
    },
  ])
})

afterEach(async () => {
  clearGitHistoryCache()
  await removeDir(repo.root)
})

describe('getGitHistory', () => {
  it('reports the repository root and HEAD', async () => {
    const history = await getGitHistory(repo.docsDir)
    expect(history.available).toBe(true)
    expect(history.repoRoot).toBe(repo.root)
    expect(history.head).toMatch(/^[0-9a-f]{40}$/)
  })

  it('uses the latest commit date per markdown file', async () => {
    const history = await getGitHistory(repo.docsDir)
    const guide = history.files.get(path.join(repo.docsDir, 'guide.md'))
    expect(guide?.lastCommit.date).toBe('2026-01-03T10:00:00.000Z')
    expect(guide?.lastCommit.author.name).toBe('Alice')
  })

  it('aggregates contributors ordered by commit count', async () => {
    const history = await getGitHistory(repo.docsDir)
    const guide = history.files.get(path.join(repo.docsDir, 'guide.md'))
    expect(guide?.contributors).toHaveLength(2)
    expect(guide?.contributors[0]).toMatchObject({
      author: { name: 'Alice', email: 'alice@example.com' },
      commits: 2,
      lastCommit: '2026-01-03T10:00:00.000Z',
    })
    expect(guide?.contributors[1].author.name).toBe('Bob')
  })

  it('ignores files that are not markdown', async () => {
    const history = await getGitHistory(repo.docsDir)
    expect(history.files.has(path.join(repo.docsDir, 'image.png'))).toBe(false)
  })

  it('returns an unavailable history outside a git repository', async () => {
    const plainDir = await createPlainDir()
    try {
      const history = await getGitHistory(plainDir)
      expect(history.available).toBe(false)
      expect(history.reason).toBe('not-a-git-repository')
      expect(history.files.size).toBe(0)
    } finally {
      await removeDir(plainDir)
    }
  })

  it('does not scan unrelated files outside the docs directory', async () => {
    const history = await getGitHistory(repo.docsDir)
    for (const file of history.files.keys()) {
      expect(file.startsWith(repo.docsDir + path.sep)).toBe(true)
    }
  })
})

describe('parseGitLog', () => {
  it('handles paths separated by NUL bytes and trims record newlines', () => {
    const output = [
      '\x1eabc\x1f2026-01-01T10:00:00Z\x1fAlice\x1falice@example.com',
      '\ndocs/a.md',
      'docs/b.mdx',
      '\x1edef\x1f2026-01-02T10:00:00Z\x1fBob\x1fbob@example.com',
      '\ndocs/a.md',
      '',
    ].join('\0')

    const files = parseGitLog(output, '/repo')
    expect([...files.keys()]).toEqual(
      expect.arrayContaining(['/repo/docs/a.md', '/repo/docs/b.mdx']),
    )
    expect(files.get('/repo/docs/a.md')?.lastCommit.hash).toBe('def')
    expect(files.get('/repo/docs/a.md')?.contributors).toHaveLength(2)
  })
})
