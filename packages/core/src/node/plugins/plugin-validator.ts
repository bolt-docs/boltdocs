import { z } from 'zod'
import semver from 'semver'
import path from 'node:path'
import { BoltdocsPluginSchema } from '../schema/config'
import {
  PluginValidationError,
  PluginCompatibilityError,
} from './plugin-errors'
import type { BoltdocsPlugin } from './plugin-types'

const PluginValidationSchema = BoltdocsPluginSchema.extend({
  version: z.string().optional(),
  boltdocsVersion: z.string().optional(),
  css: z
    .object({
      cssFiles: z.array(z.string()).optional(),
      headStyles: z.array(z.string()).optional(),
      postcssPlugins: z.array(z.any()).optional(),
      preprocessorOptions: z.record(z.string(), z.any()).optional(),
    })
    .optional(),
  hooks: z
    .object({
      beforeBuild: z
        .custom<(...args: unknown[]) => unknown>(
          (value) => typeof value === 'function',
        )
        .optional(),
      afterBuild: z
        .custom<(...args: unknown[]) => unknown>(
          (value) => typeof value === 'function',
        )
        .optional(),
      beforeDev: z
        .custom<(...args: unknown[]) => unknown>(
          (value) => typeof value === 'function',
        )
        .optional(),
      afterDev: z
        .custom<(...args: unknown[]) => unknown>(
          (value) => typeof value === 'function',
        )
        .optional(),
      buildEnd: z
        .custom<(...args: unknown[]) => unknown>(
          (value) => typeof value === 'function',
        )
        .optional(),
      transformSource: z
        .custom<(...args: unknown[]) => unknown>(
          (value) => typeof value === 'function',
        )
        .optional(),
      transformMdx: z
        .custom<(...args: unknown[]) => unknown>(
          (value) => typeof value === 'function',
        )
        .optional(),
      transformHtml: z
        .custom<(...args: unknown[]) => unknown>(
          (value) => typeof value === 'function',
        )
        .optional(),
    })
    .passthrough()
    .optional(),
})

export function validatePlugins(
  plugins: any[],
  boltdocsVersion: string,
): BoltdocsPlugin[] {
  const validatedPlugins: BoltdocsPlugin[] = []
  const pluginNames = new Set<string>()

  for (const rawPlugin of plugins) {
    const result = PluginValidationSchema.safeParse(rawPlugin)
    if (!result.success) {
      throw new PluginValidationError(
        rawPlugin.name || 'unknown',
        result.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join(', '),
      )
    }

    const plugin = result.data as BoltdocsPlugin

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
        if (compPath.includes('..')) {
          throw new PluginValidationError(
            plugin.name,
            `Component '${compName}' has an invalid path: traversal sequences are not allowed.`,
          )
        }
        if (path.isAbsolute(compPath)) {
          throw new PluginValidationError(
            plugin.name,
            `Component '${compName}' has an invalid path: absolute paths are not allowed.`,
          )
        }
      }
    }

    validatedPlugins.push(plugin)
  }

  return validatedPlugins
}
