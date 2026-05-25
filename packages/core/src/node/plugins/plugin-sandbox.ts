import { PluginPermissionError } from './plugin-errors'
import { hasPermission } from './plugin-validator'
import type { SecureBoltdocsPlugin, PluginPermission } from './plugin-types'
import { warn } from '@bdocs/dui'

/**
 * The Sandbox provides a protective layer that ensures plugins only use
 * the capabilities they have explicitly requested permissions for.
 */
export class PluginSandbox {
  /**
   * Validates if a plugin has the required permission for a capability.
   * Throws a PluginPermissionError if not granted.
   */
  public static checkPermission(
    plugin: SecureBoltdocsPlugin,
    permission: PluginPermission,
  ): void {
    if (!hasPermission(plugin, permission)) {
      throw new PluginPermissionError(plugin.name, permission)
    }
  }

  /**
   * Filters a plugin's capabilities based on its declared permissions.
   * This is used when aggregating plugins (remark, rehype, vite, components).
   */
  public static getSanitizedCapabilities(plugin: SecureBoltdocsPlugin) {
    return {
      remarkPlugins: hasPermission(plugin, 'mdx:remark')
        ? plugin.remarkPlugins
        : [],
      rehypePlugins: hasPermission(plugin, 'mdx:rehype')
        ? plugin.rehypePlugins
        : [],
      vitePlugins: hasPermission(plugin, 'vite:config')
        ? plugin.vitePlugins
        : [],
      components: hasPermission(plugin, 'components') ? plugin.components : {},
    }
  }

  /**
   * Wraps a hook execution with permission checks and error isolation.
   */
  public static async executeWithIsolation<T>(
    plugin: SecureBoltdocsPlugin,
    requiredPermission: PluginPermission,
    hookName: string,
    action: () => Promise<T> | T,
  ): Promise<T | undefined> {
    try {
      PluginSandbox.checkPermission(plugin, requiredPermission)
      return await action()
    } catch (error) {
      if (error instanceof PluginPermissionError) {
        // Log skip instead of failing hard for permissions in some contexts
        warn(
          `Skipping hook '${hookName}' for plugin '${plugin.name}': ${error.message}`,
        )
        return undefined
      }

      // Re-throw other errors to be caught by the LifecycleManager
      throw error
    }
  }
}
