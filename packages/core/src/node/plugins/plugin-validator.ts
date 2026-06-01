import { z } from 'zod'
import semver from 'semver'
import path from 'node:path'
import { BoltdocsPluginSchema } from '../schema/config'
import {
  PluginValidationError,
  PluginCompatibilityError,
} from './plugin-errors'
import type { SecureBoltdocsPlugin } from './plugin-types'

const SecurePluginSchema = BoltdocsPluginSchema.extend({
  version: z.string().optional(),
  boltdocsVersion: z.string().optional(),
  hooks: z
    .object({
      beforeBuild: z.function().optional(),
      afterBuild: z.function().optional(),
      beforeDev: z.function().optional(),
      afterDev: z.function().optional(),
      buildEnd: z.function().optional(),
      transformMdx: z.function().optional(),
      transformHtml: z.function().optional(),
    })
    .optional(),
})

export function validatePlugins(
  plugins: any[],
  boltdocsVersion: string,
): SecureBoltdocsPlugin[] {
  const validatedPlugins: SecureBoltdocsPlugin[] = []
  const pluginNames = new Set<string>()

  for (const rawPlugin of plugins) {
    const result = SecurePluginSchema.safeParse(rawPlugin)
    if (!result.success) {
      throw new PluginValidationError(
        rawPlugin.name || 'unknown',
        result.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join(', '),
      )
    }

    const plugin = result.data as SecureBoltdocsPlugin

    if (pluginNames.has(plugin.name)) {
      throw new PluginValidationError(
        plugin.name,
        'Duplicate plugin name detected',
      )
    }
    pluginNames.add(plugin.name)

    if (
      plugin.boltdocsVersion &&
      !semver.satisfies(boltdocsVersion, plugin.boltdocsVersion)
    ) {
      throw new PluginCompatibilityError(
        plugin.name,
        `Plugin expects Boltdocs version ${plugin.boltdocsVersion}, but current is ${boltdocsVersion}`,
      )
    }

    if (plugin.components) {
      for (const [compName, compPath] of Object.entries(plugin.components)) {
        if (compPath.includes('..') || path.isAbsolute(compPath)) {
          if (compPath.includes('..')) {
            throw new PluginValidationError(
              plugin.name,
              `Component '${compName}' has an invalid path: traversal sequences are not allowed.`,
            )
          }
        }
      }
    }

    validatedPlugins.push(plugin)
  }

  return validatedPlugins
}
