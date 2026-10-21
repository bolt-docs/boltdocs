import path from 'node:path'
import type { Alias, AliasOptions } from 'vite'

const RESERVED_ALIASES = new Set([
  'boltdocs/entry',
  'use-sync-external-store/shim/index.js',
  'use-sync-external-store/shim',
  'use-sync-external-store',
])

export interface BoltdocsAliasOptions {
  root: string
  /**
   * The theme package the site asked for, and the file to resolve it to.
   *
   * The engine imports the theme by name and lets the bundler resolve it,
   * because the theme is the site's dependency and not the engine's. During
   * development in a monorepo the package is aliased to its source, so an edit
   * to a theme component is picked up without a rebuild of the package.
   */
  themeSource?: { package: string; file: string }
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
  themeSource,
  aliases,
}: BoltdocsAliasOptions): Alias[] {
  const frameworkAliases: Alias[] = [
    {
      find: 'boltdocs/entry',
      replacement: path.resolve(root, 'boltdocs-entry.tsx'),
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
  ]

  // The theme package, aliased to its source when the source is there.
  //
  // The match is exact: a string alias would also capture the package's own
  // subpaths, so `@bdocs/theme-neutral/css` — the stylesheet the site loads —
  // would resolve to a file inside the source tree. A regular expression
  // matches the package name and nothing else.
  if (themeSource) {
    frameworkAliases.unshift({
      find: new RegExp(
        `^${themeSource.package.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
      ),
      // `String.replace` reads `$` in the replacement as a capture reference,
      // and a path is allowed to contain one.
      replacement: themeSource.file.replace(/\$/g, '$$$$'),
    })
  }

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
