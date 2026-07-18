import type { BoltdocsConfig, BoltdocsPlugin } from 'boltdocs'
import type { MdastPluginDefinition, HastPluginDefinition } from 'satteri'
import {
  wrapRemarkPlugin,
  wrapRemarkCodePlugin,
} from './satteri-plugins/remark-adapter'
import { wrapHastPlugin } from './satteri-plugins/rehype-adapter'

export interface UserPluginCollection {
  remarkPlugins: MdastPluginDefinition[]
  rehypePlugins: HastPluginDefinition[]
}

/**
 * Collects user-configured remark and rehype plugins from the Boltdocs config
 * and wraps them into Sätteri-compatible plugin definitions.
 */
export function collectUserPlugins(
  config: BoltdocsConfig | undefined,
): UserPluginCollection {
  const remarkPlugins: MdastPluginDefinition[] = []
  const rehypePlugins: HastPluginDefinition[] = []

  for (const plugin of config?.plugins ?? []) {
    const p = plugin as BoltdocsPlugin
    if (p.remarkPlugins) {
      for (const entry of p.remarkPlugins) {
        if (Array.isArray(entry)) {
          const [fn, opts] = entry
          if (p.name === 'boltdocs-plugin-mermaid') {
            const wrapped = wrapRemarkCodePlugin(
              fn as Parameters<typeof wrapRemarkCodePlugin>[0],
              opts as Record<string, unknown>,
              'Mermaid',
              'mermaid',
            )
            if (wrapped) remarkPlugins.push(wrapped)
          } else {
            const wrapped = wrapRemarkPlugin(
              fn as Parameters<typeof wrapRemarkPlugin>[0],
            )
            if (wrapped) remarkPlugins.push(wrapped)
          }
        } else {
          const wrapped = wrapRemarkPlugin(
            entry as Parameters<typeof wrapRemarkPlugin>[0],
          )
          if (wrapped) remarkPlugins.push(wrapped)
        }
      }
    }
    if (p.rehypePlugins) {
      for (const entry of p.rehypePlugins) {
        if (Array.isArray(entry)) {
          const wrapped = wrapHastPlugin(
            entry[0] as Parameters<typeof wrapHastPlugin>[0],
          )
          if (wrapped) rehypePlugins.push(wrapped)
        } else {
          const wrapped = wrapHastPlugin(
            entry as Parameters<typeof wrapHastPlugin>[0],
          )
          if (wrapped) rehypePlugins.push(wrapped)
        }
      }
    }
  }

  return { remarkPlugins, rehypePlugins }
}
