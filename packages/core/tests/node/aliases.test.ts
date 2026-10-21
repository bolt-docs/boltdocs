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

  it('aliases the theme package to its source during development', () => {
    const aliases = createBoltdocsAliases({
      root: '/project',
      themeSource: {
        '@bdocs/theme-neutral':
          '/workspace/packages/theme-neutral/src/index.ts',
        '@bdocs/theme-neutral/ssg':
          '/workspace/packages/theme-neutral/src/ssg/entry.ts',
      },
    })

    const theme = aliases.find((alias) =>
      alias.find instanceof RegExp
        ? alias.find.test('@bdocs/theme-neutral')
        : alias.find === '@bdocs/theme-neutral',
    )

    expect(theme).toBeDefined()
    expect(theme?.replacement).toBe(
      '/workspace/packages/theme-neutral/src/index.ts',
    )

    // The subpaths are aliased too: a theme that resolved them to its built
    // copy would serve a build that may be minutes behind the source.
    const ssg = aliases.find((alias) =>
      alias.find instanceof RegExp
        ? alias.find.test('@bdocs/theme-neutral/ssg')
        : alias.find === '@bdocs/theme-neutral/ssg',
    )
    expect(ssg?.replacement).toBe(
      '/workspace/packages/theme-neutral/src/ssg/entry.ts',
    )
  })

  it('matches the theme package exactly, so its subpaths still resolve', () => {
    const aliases = createBoltdocsAliases({
      root: '/project',
      themeSource: {
        '@bdocs/theme-neutral':
          '/workspace/packages/theme-neutral/src/index.ts',
        '@bdocs/theme-neutral/css':
          '/workspace/packages/theme-neutral/src/styles/index.css',
      },
    })

    // The stylesheet is a subpath of the same package. A prefix match would
    // rewrite it to a file inside the source tree, and the site would load no
    // CSS at all.
    const packageAlias = aliases.find(
      (alias) =>
        alias.find instanceof RegExp &&
        alias.find.test('@bdocs/theme-neutral') &&
        !alias.find.test('@bdocs/theme-neutral/css'),
    ) as { find: RegExp }

    expect(packageAlias.find.test('@bdocs/theme-neutral')).toBe(true)
    expect(packageAlias.find.test('@bdocs/theme-neutral/css')).toBe(false)
    expect(packageAlias.find.test('@bdocs/theme-neutral/composition')).toBe(
      false,
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
