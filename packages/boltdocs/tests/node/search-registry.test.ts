import { beforeEach, describe, expect, it } from 'vitest'
import {
  buildSearchData,
  getSearchGenerator,
  hasSearchGenerator,
  registerSearchGenerator,
  resetSearchRegistry,
} from '../../src/node/search/registry'
import type { RouteMeta } from '@bdocs/contracts'

const route = (path: string) =>
  ({ path, title: path, filePath: `${path}.mdx` }) as RouteMeta

describe('search registry', () => {
  beforeEach(() => {
    resetSearchRegistry()
  })

  it('reports no generator before a plugin registers one', () => {
    expect(hasSearchGenerator()).toBe(false)
    expect(getSearchGenerator()).toBeNull()
  })

  it('distinguishes "no plugin" from "an empty index"', () => {
    // The two must not look alike: only the first is worth telling a user
    // about, and returning [] for it would emit a `search.json` that no engine
    // will ever query.
    expect(buildSearchData([route('/a')])).toBeNull()

    registerSearchGenerator(() => [])
    expect(buildSearchData([route('/a')])).toEqual([])
  })

  it('hands the routes to the registered generator', () => {
    const seen: RouteMeta[][] = []
    registerSearchGenerator((routes) => {
      seen.push(routes)
      return routes.map((r) => ({
        id: r.path,
        title: r.title,
        content: '',
        url: r.path,
        display: r.title,
      }))
    })

    const routes = [route('/a'), route('/b')]
    const docs = buildSearchData(routes)

    expect(seen).toHaveLength(1)
    expect(seen[0]).toBe(routes)
    expect(docs?.map((d) => d.id)).toEqual(['/a', '/b'])
  })

  it('keeps the first registration when a second arrives', () => {
    // Two plugins generating `search.json` means which file reached the browser
    // depends on plugin load order. Refusing the second keeps it deterministic,
    // the same rule `registerPluginHighlighter` follows.
    registerSearchGenerator(() => [
      { id: 'first', title: 'a', content: '', url: '/a', display: 'a' },
    ])
    registerSearchGenerator(() => [
      { id: 'second', title: 'b', content: '', url: '/b', display: 'b' },
    ])

    expect(buildSearchData([])?.map((d) => d.id)).toEqual(['first'])
  })

  it('survives a generator that throws', () => {
    // A generator failure must not take down route generation and with it the
    // whole build. A missing search index degrades the dialog; a failed build
    // stops the site.
    registerSearchGenerator(() => {
      throw new Error('generator exploded')
    })

    expect(() => buildSearchData([route('/a')])).not.toThrow()
    expect(buildSearchData([route('/a')])).toBeNull()
  })
})
