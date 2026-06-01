export * from './plugin-types'
export * from './plugin-errors'
export * from './plugin-store'
export * from './plugin-validator'
export * from './plugin-lifecycle'
export * from './plugin-utils'
export { MDX_NODES } from '../mdx/constants'

import type { SecureBoltdocsPlugin } from './plugin-types'

export function createPlugin(
  plugin: SecureBoltdocsPlugin,
): SecureBoltdocsPlugin {
  return plugin
}
