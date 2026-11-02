import { describe, expect, it } from 'vitest'
import {
  ContributorsOptionsSchema,
  LastUpdatedOptionsSchema,
  contributorsPlugin,
} from '../src/node/index'

describe('LastUpdatedOptionsSchema', () => {
  it('applies safe defaults', () => {
    expect(LastUpdatedOptionsSchema.parse({})).toEqual({
      fallbackToMtime: false,
      overrideFrontmatter: false,
    })
  })

  it('rejects invalid path entries', () => {
    expect(() => LastUpdatedOptionsSchema.parse({ paths: [''] })).toThrow()
  })
})

describe('ContributorsOptionsSchema', () => {
  it('applies ranked, privacy-preserving defaults', () => {
    expect(ContributorsOptionsSchema.parse({})).toMatchObject({
      max: 12,
      order: 'commits',
      excludeBots: true,
      excludeAuthors: [],
      minCommits: 1,
      mergeByName: true,
      includeEmail: false,
      autoRender: true,
      profiles: {},
    })
  })

  it('mounts the footer slot only when autoRender is enabled', () => {
    expect(contributorsPlugin().client?.slots).toEqual({
      'page:footer:start': '@bdocs/plugin-git-meta/client#ContributorsSlot',
    })
    expect(contributorsPlugin({ autoRender: false }).client).toBeUndefined()
  })

  it('enforces max bounds', () => {
    expect(() => ContributorsOptionsSchema.parse({ max: 0 })).toThrow()
    expect(() => ContributorsOptionsSchema.parse({ max: 101 })).toThrow()
  })

  it('validates profile URLs', () => {
    expect(() =>
      ContributorsOptionsSchema.parse({
        profiles: { 'a@example.com': { avatar: 'not-a-url' } },
      }),
    ).toThrow()
  })
})
