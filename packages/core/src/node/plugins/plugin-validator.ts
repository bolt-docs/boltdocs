import { z } from 'zod'
import semver from 'semver'
import path from 'node:path'
import { BoltdocsPluginSchema } from '../schema/config'
import {
  PluginValidationError,
  PluginCompatibilityError,
} from './plugin-errors'
import type { SecureBoltdocsPlugin, PluginPermission } from './plugin-types'

/**
 * Enhanced Zod schema for secure plugins.
 */
export const SecurePluginSchema = BoltdocsPluginSchema.extend({
  version: z.string().optional(),
  boltdocsVersion: z.string().optional(),
  permissions: z.array(z.string()).optional(),
  hooks: z
    .object({
      beforeBuild: z.function().optional(),
      afterBuild: z.function().optional(),
      beforeDev: z.function().optional(),
      afterDev: z.function().optional(),
      configResolved: z.function().optional(),
      buildEnd: z.function().optional(),
    })
    .optional(),
})

/**
 * Validates a list of plugins for correctness, security, and compatibility.
 */
export function validatePlugins(
  plugins: any[],
  boltdocsVersion: string,
): SecureBoltdocsPlugin[] {
  const validatedPlugins: SecureBoltdocsPlugin[] = []
  const pluginNames = new Set<string>()

  for (const rawPlugin of plugins) {
    // 1. Basic Structure Validation
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

    // 2. Name Uniqueness
    if (pluginNames.has(plugin.name)) {
      throw new PluginValidationError(
        plugin.name,
        'Duplicate plugin name detected',
      )
    }
    pluginNames.add(plugin.name)

    // 3. Semver Compatibility
    if (
      plugin.boltdocsVersion &&
      !semver.satisfies(boltdocsVersion, plugin.boltdocsVersion)
    ) {
      throw new PluginCompatibilityError(
        plugin.name,
        `Plugin expects Boltdocs version ${plugin.boltdocsVersion}, but current is ${boltdocsVersion}`,
      )
    }

    // 4. Component Path Security (Path Traversal Prevention)
    if (plugin.components) {
      for (const [compName, compPath] of Object.entries(plugin.components)) {
        if (compPath.includes('..') || path.isAbsolute(compPath)) {
          // Absolute paths are technically okay but we restrict them for consistency/security
          // if they point outside the workspace. For now, we block '..' explicitly.
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

/**
 * Helper to check if a specific permission is granted to a plugin.
 */
export function hasPermission(
  plugin: SecureBoltdocsPlugin,
  permission: PluginPermission,
): boolean {
  if (!plugin.permissions) return false
  return plugin.permissions.includes(permission)
}
