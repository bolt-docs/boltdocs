import fs from 'node:fs'
import path from 'node:path'
import { warn, colors } from '@bdocs/dui'
import type { BoltdocsConfig } from '../config'

// Check if any active plugin has install hooks (postinstall, etc.) and warn the user.
export function inspectPluginsSecurity(
  config: BoltdocsConfig,
  root: string = process.cwd(),
): void {
  const plugins = config.plugins || []
  for (const plugin of plugins) {
    if (!plugin.name) continue

    try {
      let pkgJsonPath: string | null = null

      try {
        const { createRequire } = require('node:module')
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

        if (scripts.preinstall || scripts.postinstall || scripts.install) {
          warn(
            `💡 ${colors.yellow(colors.bold('Nota de seguridad:'))} El plugin ${colors.cyan(plugin.name)} ejecuta scripts nativos al instalarse. Corre ${colors.bold('boltdocs audit')} para un análisis detallado.`,
          )
        }
      }
    } catch (err) {
      // ignore resolution or parsing errors
    }
  }
}
