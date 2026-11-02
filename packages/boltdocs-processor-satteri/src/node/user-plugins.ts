import type {
  ProcessorConfig,
  ProcessorPlugin,
  ProcessorWorkerHook,
} from './processor-config'
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
 * The user plugin hooks a build worker can rebuild for itself.
 *
 * When a plugin declares them, the worker imports the module and calls the
 * export to obtain the same plugin the main thread would have used — and the
 * site keeps its parallel MDX compile instead of falling back to one page at
 * a time on the main thread.
 */
export interface WorkerHookCollection {
  remark: ProcessorWorkerHook[]
  rehype: ProcessorWorkerHook[]
  /**
   * Whether every user plugin that has an in-process hook also declares a
   * worker hook.
   *
   * A plugin with only an in-process hook would silently produce different
   * output in the worker than on the main thread, so the pool cannot be used
   * while such a plugin is present.
   */
  complete: boolean
}

/**
 * Collect the worker-rebuildable hooks from the configured plugins.
 */
export function collectWorkerHooks(
  config: ProcessorConfig | undefined,
): WorkerHookCollection {
  const remark: ProcessorWorkerHook[] = []
  const rehype: ProcessorWorkerHook[] = []
  let complete = true

  for (const plugin of config?.plugins ?? []) {
    const p = plugin as ProcessorPlugin
    const declaredRemark = p.workerHooks?.remark ?? []
    const declaredRehype = p.workerHooks?.rehype ?? []

    remark.push(...declaredRemark)
    rehype.push(...declaredRehype)

    // A plugin with an in-process hook and no worker hook cannot be
    // reproduced in a worker.
    if ((p.remarkPlugins?.length ?? 0) > declaredRemark.length) complete = false
    if ((p.rehypePlugins?.length ?? 0) > declaredRehype.length) complete = false
  }

  return { remark, rehype, complete }
}

function stableOptions(value: unknown): string {
  try {
    return JSON.stringify(value, (_key, current) =>
      typeof current === 'function'
        ? `[function:${current.toString()}]`
        : current,
    )
  } catch {
    return '[unserializable]'
  }
}

/**
 * User plugin factories may capture state that cannot be observed from
 * Function#toString(). Keep their results in the current process, but never
 * reuse their compiled output from a different process unless a future
 * explicit plugin cache contract is added.
 */
function annotateUserPlugin<T>(
  plugin: T,
  owner: ProcessorPlugin,
  options?: unknown,
): T {
  if (!plugin || typeof plugin !== 'object') return plugin
  const target = plugin as Record<string, unknown>
  if (target.__boltdocsPersistentCache === false) return plugin
  Object.defineProperties(target, {
    __boltdocsCacheSignature: {
      value: `${owner.name}@${owner.version ?? '0'}:${stableOptions(options)}`,
      enumerable: false,
      configurable: true,
    },
    __boltdocsPersistentCache: {
      value: false,
      enumerable: false,
      configurable: true,
    },
  })
  return plugin
}

/**
 * Collects user-configured remark and rehype plugins from the Boltdocs config
 * and wraps them into Sätteri-compatible plugin definitions.
 */
export function collectUserPlugins(
  config: ProcessorConfig | undefined,
): UserPluginCollection {
  const remarkPlugins: MdastPluginDefinition[] = []
  const rehypePlugins: HastPluginDefinition[] = []

  for (const plugin of config?.plugins ?? []) {
    const p = plugin as ProcessorPlugin
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
            if (wrapped) {
              remarkPlugins.push(annotateUserPlugin(wrapped, p, opts))
            }
          } else {
            const wrapped = wrapRemarkPlugin(
              fn as Parameters<typeof wrapRemarkPlugin>[0],
            )
            if (wrapped) {
              remarkPlugins.push(annotateUserPlugin(wrapped, p, opts))
            }
          }
        } else {
          const wrapped = wrapRemarkPlugin(
            entry as Parameters<typeof wrapRemarkPlugin>[0],
          )
          if (wrapped) remarkPlugins.push(annotateUserPlugin(wrapped, p))
        }
      }
    }
    if (p.rehypePlugins) {
      for (const entry of p.rehypePlugins) {
        if (Array.isArray(entry)) {
          const wrapped = wrapHastPlugin(
            entry[0] as Parameters<typeof wrapHastPlugin>[0],
          )
          if (wrapped) {
            rehypePlugins.push(annotateUserPlugin(wrapped, p, entry[1]))
          }
        } else {
          const wrapped = wrapHastPlugin(
            entry as Parameters<typeof wrapHastPlugin>[0],
          )
          if (wrapped) rehypePlugins.push(annotateUserPlugin(wrapped, p))
        }
      }
    }
  }

  return { remarkPlugins, rehypePlugins }
}
