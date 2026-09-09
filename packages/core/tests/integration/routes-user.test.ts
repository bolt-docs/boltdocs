import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { generateRoutes, invalidateRouteCache } from '../../src/node/routes'
import { sortRoutes } from '../../src/node/routes/sorter'

let tempDir: string
let docsDir: string

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-user-'))
  docsDir = path.join(tempDir, 'docs')
  fs.mkdirSync(docsDir, { recursive: true })
})

afterEach(() => {
  invalidateRouteCache(docsDir)
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})

function writeFile(relative: string, content: string): void {
  const target = path.join(docsDir, relative)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, content)
}

async function generate(config: Record<string, unknown> = {}) {
  return generateRoutes(docsDir, config as any, '/docs', true)
}

describe('user-facing route metadata', () => {
  it('excludes draft pages by default and exposes them when drafts.visible is set', async () => {
    writeFile('wip.md', '---\ntitle: WIP\ndraft: true\n---\n# WIP')
    writeFile('done.md', '---\ntitle: Done\n---\n# Done')

    const hidden = await generate()
    expect(hidden.map((r) => r.title)).toEqual(['Done'])

    const shown = await generate({ drafts: { visible: true } })
    expect(shown.map((r) => r.title).sort()).toEqual(['Done', 'WIP'])
  })

  it('respects draft visibility via environments when the current NODE_ENV matches', async () => {
    writeFile('draft.md', '---\ntitle: Draft\ndraft: true\n---\n# Draft')

    const nodeEnv = process.env.NODE_ENV || 'development'
    const matching = await generate({
      drafts: { environments: [nodeEnv] },
    })
    expect(matching.map((r) => r.title)).toEqual(['Draft'])

    const other = await generate({
      drafts: { environments: ['never-this-env'] },
    })
    expect(other.map((r) => r.title)).toEqual([])
  })

  it('parses the badge string from frontmatter', async () => {
    writeFile('feature.md', '---\ntitle: Feature\nbadge: New\n---\n# Feature')
    const routes = await generate()
    expect(routes.find((r) => r.title === 'Feature')?.badge).toBe('New')
  })

  it('infers the tab from a (tab-name) directory prefix and keeps it in the path', async () => {
    writeFile(
      '(quickstart)/guide.md',
      '---\ntitle: Quick Guide\n---\n# Quick Guide',
    )
    const routes = await generate()
    const guide = routes.find((r) => r.title === 'Quick Guide')
    expect(guide).toMatchObject({
      path: '/docs/quickstart/guide',
      tab: 'quickstart',
    })
  })

  it('keeps the tab in the path for localized pages', async () => {
    writeFile('es/(guias)/inicio.md', '---\ntitle: Inicio\n---\n# Inicio')
    const routes = await generate({
      i18n: { defaultLocale: 'en', locales: { en: 'English', es: 'Español' } },
    })
    const inicio = routes.find((r) => r.title === 'Inicio')
    expect(inicio).toMatchObject({
      path: '/docs/es/guias/inicio',
      locale: 'es',
      tab: 'guias',
    })
  })

  it('resolves collection posts and sorts them newest-first by date', async () => {
    writeFile(
      '[blog]/post-1.md',
      '---\ntitle: Post One\ndate: 2026-01-01\n---\n# Post One',
    )
    writeFile(
      '[blog]/post-2.md',
      '---\ntitle: Post Two\ndate: 2026-03-01\n---\n# Post Two',
    )
    writeFile(
      '[blog]/post-3.md',
      '---\ntitle: Post Three\ndate: 2026-02-01\n---\n# Post Three',
    )
    const routes = await generate()
    const posts = routes.filter((r) => r.collection === 'blog')
    expect(posts.map((r) => r.title)).toEqual([
      'Post Two',
      'Post Three',
      'Post One',
    ])
    expect(posts.every((r) => r.path.startsWith('/blog/'))).toBe(true)
  })

  it('resolves versioned paths and marks the version', async () => {
    writeFile('v1/guide.md', '---\ntitle: Guide v1\n---\n# Guide v1')
    const routes = await generate({
      versions: {
        versions: [{ label: 'v1', path: 'v1' }],
      },
    })
    const guide = routes.find((r) => r.title === 'Guide v1')
    expect(guide).toMatchObject({
      path: '/docs/v1/guide',
      version: 'v1',
    })
  })

  it('applies group title and position from the group index frontmatter and sorts groups', async () => {
    writeFile(
      'intro/_index.md',
      '---\ntitle: Intro\ngroupTitle: Introduction\ngroupPosition: 1\n---\n# Intro',
    )
    writeFile('intro/start.md', '---\ntitle: Start Here\n---\n# Start Here')
    writeFile(
      'guides/_index.md',
      '---\ntitle: Guides\ngroupTitle: Deep Guides\ngroupPosition: 2\n---\n# Guides',
    )
    writeFile('guides/advanced.md', '---\ntitle: Advanced\n---\n# Advanced')
    writeFile('standalone.md', '---\ntitle: Standalone\n---\n# Standalone')

    const routes = await generate()
    const groups = [
      ...new Set(
        routes.map((r) => r.groupTitle).filter((title) => title !== undefined),
      ),
    ]
    expect(groups).toEqual(['Introduction', 'Deep Guides'])
    // The ungrouped page has no position, so it falls to the default 999.
    expect(routes[routes.length - 1].title).toBe('Standalone')
    expect(routes[0]).toMatchObject({ group: 'intro', groupPosition: 1 })
    expect(routes[2]).toMatchObject({
      group: 'guides',
      groupPosition: 2,
      groupTitle: 'Deep Guides',
    })
  })

  it('generates i18n fallback routes for missing translations', async () => {
    writeFile('guide.md', '---\ntitle: Guide\n---\n# Guide')
    const routes = await generate({
      i18n: { defaultLocale: 'en', locales: { en: 'English', es: 'Español' } },
    })

    const en = routes.find((r) => r.path === '/docs/guide')
    const es = routes.find((r) => r.path === '/docs/es/guide')
    expect(en).toMatchObject({ title: 'Guide' })
    expect(es).toMatchObject({ title: 'Guide', locale: 'es' })
  })

  it('does not create fallback routes when a translation already exists', async () => {
    writeFile('guide.md', '---\ntitle: Guide\n---\n# Guide')
    writeFile('es/guide.md', '---\ntitle: Guía\n---\n# Guía')
    const routes = await generate({
      i18n: { defaultLocale: 'en', locales: { en: 'English', es: 'Español' } },
    })

    const es = routes.filter((r) => r.locale === 'es')
    expect(es).toHaveLength(1)
    expect(es[0].title).toBe('Guía')
  })
})

describe('sortRoutes', () => {
  const route = (overrides: Record<string, unknown>) =>
    ({
      path: '/docs/x',
      title: 'X',
      ...overrides,
    }) as any

  it('sorts by effective position, with ungrouped items winning position ties', () => {
    const routes = sortRoutes([
      route({
        title: 'Zeta',
        sidebarPosition: 1,
        group: 'g1',
        groupPosition: 2,
      }),
      route({ title: 'Alpha', sidebarPosition: 2 }),
      route({ title: 'Beta', sidebarPosition: 1 }),
      route({
        title: 'Gamma',
        sidebarPosition: 5,
        group: 'g0',
        groupPosition: 1,
      }),
    ])

    // Effective position = groupPosition for grouped routes, sidebarPosition
    // for ungrouped ones. Ungrouped items precede grouped ones within a tie.
    expect(routes.map((r) => r.title)).toEqual([
      'Beta',
      'Gamma',
      'Alpha',
      'Zeta',
    ])
  })

  it('sorts items within a group by sidebar position then title', () => {
    const routes = sortRoutes([
      route({
        title: 'B',
        sidebarPosition: 2,
        group: 'g',
        groupTitle: 'G',
        groupPosition: 1,
      }),
      route({
        title: 'A',
        sidebarPosition: 1,
        group: 'g',
        groupTitle: 'G',
        groupPosition: 1,
      }),
      route({ title: 'C', group: 'g', groupTitle: 'G', groupPosition: 1 }),
    ])
    expect(routes.map((r) => r.title)).toEqual(['A', 'B', 'C'])
  })

  it('sorts groups alphabetically when positions tie', () => {
    const routes = sortRoutes([
      route({ title: 'Z', group: 'zz', groupTitle: 'Zed', groupPosition: 1 }),
      route({ title: 'A', group: 'aa', groupTitle: 'Alpha', groupPosition: 1 }),
    ])
    expect(routes.map((r) => r.groupTitle)).toEqual(['Alpha', 'Zed'])
  })

  it('falls back to path comparison for identical title and position', () => {
    const routes = sortRoutes([
      route({ title: 'Same', sidebarPosition: 3, path: '/docs/b' }),
      route({ title: 'Same', sidebarPosition: 3, path: '/docs/a' }),
    ])
    expect(routes.map((r) => r.path)).toEqual(['/docs/a', '/docs/b'])
  })
})
