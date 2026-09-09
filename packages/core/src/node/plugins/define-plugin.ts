import type { BoltdocsPlugin } from './plugin-types'

export type PluginFactory<TOptions = Record<string, unknown>> = (
  options?: TOptions,
) => BoltdocsPlugin

/**
 * Creates and defines a Boltdocs plugin with strong TypeScript inference.
 * Supports both a static plugin object or an options-factory function.
 *
 * @example
 * ```ts
 * export default definePlugin<MyOptions>((options) => ({
 *   name: 'my-plugin',
 *   version: '1.0.0',
 *   client: {
 *     slots: { 'header:right': './components/HeaderActions.tsx' },
 *   },
 *   hooks: {
 *     'frontmatter:transform'(ctx, { frontmatter }) {
 *       return { ...frontmatter, readingTime: 5 }
 *     },
 *   },
 * }))
 * ```
 */
export function definePlugin<TOptions = Record<string, unknown>>(
  pluginOrFactory: BoltdocsPlugin | PluginFactory<TOptions>,
): PluginFactory<TOptions> & ((options?: TOptions) => BoltdocsPlugin) {
  const factory = (options?: TOptions): BoltdocsPlugin => {
    if (typeof pluginOrFactory === 'function') {
      return pluginOrFactory(options)
    }
    return pluginOrFactory
  }

  return factory as PluginFactory<TOptions> &
    ((options?: TOptions) => BoltdocsPlugin)
}

/**
 * Alias for `definePlugin` for backwards compatibility.
 */
export function createPlugin<TOptions = Record<string, unknown>>(
  pluginOrFactory: BoltdocsPlugin | PluginFactory<TOptions>,
):
  | BoltdocsPlugin
  | (PluginFactory<TOptions> & ((options?: TOptions) => BoltdocsPlugin)) {
  if (typeof pluginOrFactory === 'function') {
    return definePlugin(pluginOrFactory)
  }
  return pluginOrFactory
}
