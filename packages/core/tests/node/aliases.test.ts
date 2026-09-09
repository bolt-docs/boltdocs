import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createBoltdocsAliases, normalizeAliases } from '../../src/node/aliases'

describe('createBoltdocsAliases', () => {
  it('includes every runtime alias in published installs', () => {
    const aliases = createBoltdocsAliases({ root: '/project' })

    expect(aliases).toEqual([
      {
        find: 'boltdocs/entry',
        replacement: '/project/boltdocs-entry.tsx',
      },
      {
        find: 'boltdocs/client',
        replacement: '/project/boltdocs-client.mjs',
      },
      {
        find: 'use-sync-external-store/shim/index.js',
        replacement: 'react',
      },
      {
        find: 'use-sync-external-store/shim',
        replacement: 'react',
      },
      {
        find: 'use-sync-external-store',
        replacement: 'react',
      },
    ])
  })

  it('uses source aliases for the monorepo development client', () => {
    const aliases = createBoltdocsAliases({
      root: '/project',
      clientSourceRoot: '/workspace/packages/core/src/client',
    })

    expect(aliases).toEqual(
      expect.arrayContaining([
        {
          find: 'boltdocs/primitives',
          replacement: '/workspace/packages/core/src/client/primitives.ts',
        },
        {
          find: 'boltdocs/mdx',
          replacement: '/workspace/packages/core/src/client/mdx.ts',
        },
        {
          find: 'boltdocs/client/router',
          replacement: '/workspace/packages/core/src/client/router/index.ts',
        },
      ]),
    )
  })

  it('includes framework aliases and custom aliases', () => {
    const aliases = createBoltdocsAliases({
      root: '/project',
      aliases: {
        '@components': '/project/src/components',
      },
    })

    expect(aliases).toEqual(
      expect.arrayContaining([
        {
          find: 'boltdocs/entry',
          replacement: path.resolve('/project', 'boltdocs-entry.tsx'),
        },
        {
          find: '@components',
          replacement: '/project/src/components',
        },
      ]),
    )
  })

  it('supports array aliases from Vite', () => {
    const aliases = createBoltdocsAliases({
      root: '/project',
      aliases: [
        { find: /^~(.*)$/, replacement: '$1' },
        { find: '@ui', replacement: '/project/src/ui' },
      ],
    })

    expect(aliases).toEqual(
      expect.arrayContaining([
        { find: /^~(.*)$/, replacement: '$1' },
        { find: '@ui', replacement: '/project/src/ui' },
      ]),
    )
  })

  it('normalizes object and array alias formats without mutating input', () => {
    const objectAliases = { '@ui': './src/ui' }
    const arrayAliases = [{ find: '@data', replacement: './src/data' }]

    const normalizedObject = normalizeAliases(objectAliases)
    const normalizedArray = normalizeAliases(arrayAliases)

    expect(normalizedObject).toEqual([{ find: '@ui', replacement: './src/ui' }])
    expect(normalizedArray).toEqual(arrayAliases)
    expect(normalizedArray).not.toBe(arrayAliases)
    expect(objectAliases).toEqual({ '@ui': './src/ui' })
    expect(arrayAliases).toEqual([{ find: '@data', replacement: './src/data' }])
  })

  it('resolves relative replacements from the project root', () => {
    const aliases = createBoltdocsAliases({
      root: '/project',
      aliases: { '@components': './src/components' },
    })

    expect(aliases).toEqual(
      expect.arrayContaining([
        {
          find: '@components',
          replacement: path.resolve('/project/src/components'),
        },
      ]),
    )
  })

  it('resolves nested and parent-relative replacements from root', () => {
    const aliases = createBoltdocsAliases({
      root: '/project/docs',
      aliases: {
        '@nested': './src/components',
        '@shared': '../shared/src',
      },
    })

    expect(aliases).toEqual(
      expect.arrayContaining([
        {
          find: '@nested',
          replacement: '/project/docs/src/components',
        },
        {
          find: '@shared',
          replacement: '/project/shared/src',
        },
      ]),
    )
  })

  it('keeps every reserved framework alias authoritative', () => {
    const reservedAliases = [
      'boltdocs/entry',
      'boltdocs/client',
      'boltdocs/primitives',
      'boltdocs/mdx',
      'boltdocs/client/router',
      'use-sync-external-store/shim/index.js',
      'use-sync-external-store/shim',
      'use-sync-external-store',
    ]
    const customAliases: Record<string, string> = {}
    for (const alias of reservedAliases) {
      customAliases[alias] = '/project/overridden'
    }
    const aliases = createBoltdocsAliases({
      root: '/project',
      clientSourceRoot: '/workspace/core/src/client',
      aliases: customAliases,
    })

    for (const alias of reservedAliases) {
      expect(aliases.filter((item) => item.find === alias)).toHaveLength(1)
      expect(aliases.find((item) => item.find === alias)?.replacement).not.toBe(
        '/project/overridden',
      )
    }
  })

  it('keeps user aliases in order after framework aliases', () => {
    const aliases = createBoltdocsAliases({
      root: '/project',
      aliases: [
        { find: '@first', replacement: './src/first' },
        { find: /^@legacy\/(.*)$/, replacement: './src/$1' },
        { find: '@second', replacement: './src/second' },
      ],
    })

    expect(aliases.slice(-3)).toEqual([
      { find: '@first', replacement: '/project/src/first' },
      { find: /^@legacy\/(.*)$/, replacement: '/project/src/$1' },
      { find: '@second', replacement: '/project/src/second' },
    ])
  })
})
