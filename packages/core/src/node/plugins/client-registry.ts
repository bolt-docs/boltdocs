import type { BoltdocsPlugin, PluginClientConfig } from '../../shared/types'

export interface ResolvedClientRegistry {
  slots: Record<string, string[]>
  providers: string[]
  mdxComponents: Record<string, string>
  head: PluginClientConfig['head']
}

/**
 * Aggregates client UI slots, providers, MDX components, and head entries
 * across all configured plugins.
 */
export function resolveClientRegistry(
  plugins: BoltdocsPlugin[] = [],
): ResolvedClientRegistry {
  const registry: ResolvedClientRegistry = {
    slots: {},
    providers: [],
    mdxComponents: {},
    head: [],
  }

  for (const plugin of plugins) {
    const client = plugin.client
    if (!client) continue

    // Aggregate slots (multiple plugins can contribute to the same slot)
    if (client.slots) {
      for (const [slotName, componentPath] of Object.entries(client.slots)) {
        if (!registry.slots[slotName]) {
          registry.slots[slotName] = []
        }
        registry.slots[slotName].push(componentPath)
      }
    }

    // Aggregate providers
    if (client.providers) {
      for (const providerPath of client.providers) {
        if (!registry.providers.includes(providerPath)) {
          registry.providers.push(providerPath)
        }
      }
    }

    // Aggregate MDX components
    if (client.mdxComponents) {
      for (const [compName, compPath] of Object.entries(client.mdxComponents)) {
        registry.mdxComponents[compName] = compPath
      }
    }

    // Aggregate head entries
    if (client.head) {
      registry.head?.push(...client.head)
    }
  }

  return registry
}
