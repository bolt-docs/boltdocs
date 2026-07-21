export * from './plugin-types'
export * from './plugin-errors'
export * from './plugin-store'
export * from './plugin-validator'
export * from './plugin-lifecycle'

// Re-export the AST utilities from the public @bdocs/unist-utils package.
// The local `./plugin-utils` file remains as a thin re-export shim for
// in-monorepo consumers that have not migrated yet.
export * from '@bdocs/unist-utils'

import type { SecureBoltdocsPlugin } from './plugin-types'

export function createPlugin(
  plugin: SecureBoltdocsPlugin,
): SecureBoltdocsPlugin {
  return plugin
}
