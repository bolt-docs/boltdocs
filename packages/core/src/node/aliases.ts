import path from 'node:path'
import type { Alias, AliasOptions } from 'vite'

const RESERVED_ALIASES = new Set([
  'boltdocs/entry',
  'boltdocs/client',
  'boltdocs/primitives',
  'boltdocs/mdx',
  'boltdocs/client/router',
  'use-sync-external-store/shim/index.js',
  'use-sync-external-store/shim',
  'use-sync-external-store',
])

export interface BoltdocsAliasOptions {
  root: string
  clientSourceRoot?: string
  aliases?: AliasOptions
}

export function normalizeAliases(aliases: AliasOptions | undefined): Alias[] {
  if (!aliases) return []
  if (Array.isArray(aliases)) return [...aliases]

  return Object.entries(aliases).map(([find, replacement]) => ({
    find,
    replacement,
  }))
}

function addAlias(aliases: Alias[], alias: Alias): void {
  if (
    typeof alias.find === 'string' &&
    RESERVED_ALIASES.has(alias.find) &&
    aliases.some((item) => item.find === alias.find)
  ) {
    return
  }

  aliases.push({
    ...alias,
    ...(typeof alias.replacement === 'string'
      ? { replacement: alias.replacement }
      : {}),
  })
}

/**
 * Builds the complete alias list while keeping framework aliases authoritative.
 * User aliases are appended so Vite can still handle custom regex aliases and
 * aliases coming from `vite.resolve.alias` without replacing framework entries.
 */
export function createBoltdocsAliases({
  root,
  clientSourceRoot,
  aliases,
}: BoltdocsAliasOptions): Alias[] {
  const frameworkAliases: Alias[] = [
    {
      find: 'boltdocs/entry',
      replacement: path.resolve(root, 'boltdocs-entry.tsx'),
    },
    {
      find: 'boltdocs/client',
      replacement: path.resolve(root, 'boltdocs-client.mjs'),
    },
    ...(clientSourceRoot
      ? [
          {
            find: 'boltdocs/primitives',
            replacement: path.join(clientSourceRoot, 'primitives.ts'),
          },
          {
            find: 'boltdocs/mdx',
            replacement: path.join(clientSourceRoot, 'mdx.ts'),
          },
          {
            find: 'boltdocs/client/router',
            replacement: path.join(clientSourceRoot, 'router/index.ts'),
          },
        ]
      : []),
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
  ]

  const result = frameworkAliases.map((alias) => ({
    ...alias,
    replacement: alias.replacement,
  }))
  for (const alias of normalizeAliases(aliases)) {
    addAlias(result, {
      ...alias,
      replacement:
        typeof alias.replacement === 'string' &&
        alias.replacement.startsWith('.')
          ? path.resolve(root, alias.replacement)
          : alias.replacement,
    })
  }
  return result
}
