import { describe, expect, it } from 'vitest'
import { compareByDateDesc, sortByDateDesc } from '@bdocs/contracts'

describe('collection date ordering contract', () => {
  it('sorts newest first and breaks ties by path', () => {
    const posts = [
      { path: '/blog/a', date: '2026-01-01' },
      { path: '/blog/b', date: '2026-03-01' },
      { path: '/blog/c', date: '2026-02-01' },
    ]
    expect(sortByDateDesc(posts).map((p) => p.path)).toEqual([
      '/blog/b',
      '/blog/c',
      '/blog/a',
    ])
  })

  it('puts undated and invalid dates last, then orders by path', () => {
    const posts = [
      { path: '/blog/z', date: undefined },
      { path: '/blog/a', date: 'not-a-date' },
      { path: '/blog/m', date: new Date('2026-01-01') },
    ]
    expect(sortByDateDesc(posts).map((p) => p.path)).toEqual([
      '/blog/m',
      '/blog/a',
      '/blog/z',
    ])
  })

  it('does not mutate the input array', () => {
    const posts = [
      { path: '/blog/a', date: '2026-01-01' },
      { path: '/blog/b', date: '2026-03-01' },
    ]
    sortByDateDesc(posts)
    expect(posts.map((p) => p.path)).toEqual(['/blog/a', '/blog/b'])
    expect(compareByDateDesc(posts[1], posts[0])).toBeLessThan(0)
  })
})
