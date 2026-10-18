import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateRoutes } from '../../src/node/routes'
import type { BoltdocsConfig } from '../../src/node/config'
import type { BoltdocsPlugin } from '../../src/shared/types'

const dirs: string[] = []

async function createDocsDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'boltdocs-routes-hook-'))
  dirs.push(dir)
  await fs.writeFile(
    path.join(dir, 'index.md'),
    '---\ntitle: Home\n---\n\n# Home\n',
  )
  await fs.mkdir(path.join(dir, 'guides'), { recursive: true })
  await fs.writeFile(
    path.join(dir, 'guides', 'start.md'),
    '---\ntitle: Start\nsidebarPosition: 1\n---\n\n# Start\n',
  )
  return dir
}

afterEach(async () => {
  for (const dir of dirs.splice(0)) {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

describe('routes:resolved lifecycle hook', () => {
  it('enriches the routes returned by generateRoutes', async () => {
    const docsDir = await createDocsDir()
    const plugin: BoltdocsPlugin = {
      name: 'test-routes-resolved',
      hooks: {
        'routes:resolved'(_ctx, { routes }) {
          for (const route of routes) {
            route.badge = 'hooked'
            route.contributors = [
              {
                name: 'Test Author',
                commits: 1,
                lastCommit: '2026-01-01T00:00:00.000Z',
              },
            ]
          }
          return routes
        },
      },
    }

    const routes = await generateRoutes(
      docsDir,
      { plugins: [plugin] } as BoltdocsConfig,
      '/docs',
      true,
    )

    expect(routes.length).toBeGreaterThan(0)
    expect(routes.every((route) => route.badge === 'hooked')).toBe(true)
    expect(routes[0].contributors?.[0].name).toBe('Test Author')
  })

  it('accepts a replaced route array from the hook', async () => {
    const docsDir = await createDocsDir()
    const plugin: BoltdocsPlugin = {
      name: 'test-replace-routes',
      hooks: {
        'routes:resolved'(_ctx, { routes }) {
          return routes.map((route) => ({
            ...route,
            title: `Hook: ${route.title}`,
          }))
        },
      },
    }

    const routes = await generateRoutes(
      docsDir,
      { plugins: [plugin] } as BoltdocsConfig,
      '/docs',
      true,
    )

    expect(routes.every((route) => route.title.startsWith('Hook: '))).toBe(true)
  })

  it('pipes the returned array through multiple plugins', async () => {
    const docsDir = await createDocsDir()
    const observed: unknown[] = []
    const first: BoltdocsPlugin = {
      name: 'test-first',
      hooks: {
        'routes:resolved'(_ctx, { routes }) {
          return routes.map((route) => ({ ...route, badge: 'first' }))
        },
      },
    }
    const second: BoltdocsPlugin = {
      name: 'test-second',
      hooks: {
        'routes:resolved'(_ctx, { routes }) {
          observed.push(...routes.map((route) => route.badge))
          return routes.map((route) => ({
            ...route,
            title: `Second: ${route.title}`,
          }))
        },
      },
    }

    const routes = await generateRoutes(
      docsDir,
      { plugins: [first, second] } as BoltdocsConfig,
      '/docs',
      true,
    )

    expect(observed).toContain('first')
    expect(routes.every((route) => route.title.startsWith('Second: '))).toBe(
      true,
    )
  })

  it('keeps routes intact when the hook throws', async () => {
    const docsDir = await createDocsDir()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const plugin: BoltdocsPlugin = {
        name: 'test-throwing-hook',
        hooks: {
          'routes:resolved'() {
            throw new Error('boom')
          },
        },
      }

      const routes = await generateRoutes(
        docsDir,
        { plugins: [plugin] } as BoltdocsConfig,
        '/docs',
        true,
      )

      expect(routes.length).toBeGreaterThan(0)
      expect(routes.every((route) => route.title !== '')).toBe(true)
    } finally {
      errorSpy.mockRestore()
    }
  })

  it('does not load the plugin lifecycle without hooks', async () => {
    const docsDir = await createDocsDir()
    const routes = await generateRoutes(
      docsDir,
      {} as BoltdocsConfig,
      '/docs',
      true,
    )
    expect(routes.length).toBeGreaterThan(0)
    expect(routes[0].badge).toBeUndefined()
  })
})
