import { describe, it, expect } from 'vitest'
import { collectWorkerHooks } from '../node/user-plugins'
import type { ProcessorConfig } from '../node/processor-config'

/**
 * The hooks a build worker rebuilds for itself.
 *
 * A remark or rehype plugin is a function, and a function cannot cross a
 * worker boundary. A plugin that describes its hook for a worker lets the
 * site keep its parallel MDX compile instead of compiling one page at a time
 * on the main thread — which, on the documentation site, is the difference
 * between 5.9 s and 6.8 s for 234 pages.
 *
 * The rule that matters: a plugin with an in-process hook and no worker hook
 * cannot be reproduced in a worker, so the pool has to stay off. Getting
 * that wrong would make the worker compile pages differently from the main
 * thread, and the output would depend on which worker compiled which page.
 */
describe('collectWorkerHooks', () => {
  const workerHook = {
    module: '@bdocs/plugin-mermaid',
    export: 'remarkMermaid',
    options: { themes: { light: {}, dark: {} } },
  }

  it('collects the hooks a plugin declares', () => {
    const config: ProcessorConfig = {
      plugins: [
        {
          name: 'boltdocs-plugin-mermaid',
          remarkPlugins: [[() => undefined, workerHook.options]],
          workerHooks: { remark: [workerHook] },
        },
      ],
    }

    const hooks = collectWorkerHooks(config)

    expect(hooks.remark).toHaveLength(1)
    expect(hooks.remark[0].module).toBe('@bdocs/plugin-mermaid')
    expect(hooks.remark[0].export).toBe('remarkMermaid')
  })

  it('reports a plugin with only an in-process hook as incomplete', () => {
    const config: ProcessorConfig = {
      plugins: [
        {
          name: 'boltdocs-plugin-mermaid',
          remarkPlugins: [[() => undefined, {}]],
        },
      ],
    }

    expect(collectWorkerHooks(config).complete).toBe(false)
  })

  it('reports a plugin whose hooks are all declared as complete', () => {
    const config: ProcessorConfig = {
      plugins: [
        {
          name: 'boltdocs-plugin-mermaid',
          remarkPlugins: [[() => undefined, {}]],
          workerHooks: { remark: [workerHook] },
        },
      ],
    }

    expect(collectWorkerHooks(config).complete).toBe(true)
  })

  it('counts a plugin with no hooks at all as complete', () => {
    const config: ProcessorConfig = {
      plugins: [{ name: 'plugin-tailwindcss' }],
    }

    const hooks = collectWorkerHooks(config)

    expect(hooks.complete).toBe(true)
    expect(hooks.remark).toHaveLength(0)
  })
})
