import { warn, colors } from '@bdocs/dui'
import type { BoltdocsConfig } from '../config'
import { resolvePluginPackage } from './audit/resolve'

// Cache: once we check a plugin name, remember the result
const _securityInspectCache = new Map<string, boolean>()

// Check if any active plugin has install hooks (postinstall, etc.) and warn the user.
export function inspectPluginsSecurity(
  config: BoltdocsConfig,
  root: string = process.cwd(),
): void {
  const plugins = config.plugins || []
  for (const plugin of plugins) {
    if (!plugin.name) continue
    // Skip if we already checked this plugin in this process
    if (_securityInspectCache.has(plugin.name)) continue

    try {
      // Shared with the audit engine — path resolution + package.json read only.
      // Never imports or executes the plugin's code.
      const resolved = resolvePluginPackage(plugin.name, root)
      const pkg = resolved?.pkg
      const scripts =
        pkg && typeof pkg.scripts === 'object'
          ? (pkg.scripts as Record<string, string>)
          : {}

      const hasInstallScript = !!(
        scripts.preinstall ||
        scripts.postinstall ||
        scripts.install
      )
      if (hasInstallScript) {
        warn(
          `💡 ${colors.yellow(colors.bold('Nota de seguridad:'))} El plugin ${colors.cyan(plugin.name)} ejecuta scripts nativos al instalarse. Corre ${colors.bold('boltdocs audit')} para un análisis detallado.`,
        )
      }
      _securityInspectCache.set(plugin.name, hasInstallScript)
    } catch {
      // ignore resolution or parsing errors
      _securityInspectCache.set(plugin.name, false)
    }
  }
}
