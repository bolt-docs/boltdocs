import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { warn, colors } from '@bdocs/dui'
import type { BoltdocsConfig } from '../config'

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
      let pkgJsonPath: string | null = null

      try {
        const localRequire = createRequire(path.resolve(root, 'package.json'))
        pkgJsonPath = localRequire.resolve(`${plugin.name}/package.json`)
      } catch (e) {
        const localPath = path.resolve(
          root,
          'node_modules',
          plugin.name,
          'package.json',
        )
        if (fs.existsSync(localPath)) {
          pkgJsonPath = localPath
        }
      }

      if (pkgJsonPath && fs.existsSync(pkgJsonPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'))
        const scripts = pkg.scripts || {}

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
      } else {
        _securityInspectCache.set(plugin.name, false)
      }
    } catch (err) {
      // ignore resolution or parsing errors
      _securityInspectCache.set(plugin.name, false)
    }
  }
}
