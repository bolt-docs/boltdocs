import type { Plugin } from 'vite'
import fs from 'node:fs'
import type { BoltdocsConfig, IPluginLifecycleManager } from 'boltdocs'
import { createSatteriProcessorPlugin } from './index'
import { collectUserPlugins } from './user-plugins'
import { MdxCompiler } from './compiler'

function isMdx(id: string): boolean {
  const [cleanId] = id.split('?')
  return cleanId.endsWith('.md') || cleanId.endsWith('.mdx')
}

function looksCompiled(code: string): boolean {
  return (
    code.includes('function _createMdxContent') ||
    code.includes('react/jsx-runtime') ||
    code.includes('export default function MDXContent')
  )
}

export function createSatteriMdxPlugin(
  config: BoltdocsConfig,
  getLifecycle: () => IPluginLifecycleManager | undefined,
): Plugin {
  const processor = createSatteriProcessorPlugin()
  const mdastPlugins = processor.mdastPlugins ?? []
  const hastPlugins = processor.hastPlugins ?? []

  const {
    remarkPlugins: adaptedRemarkPlugins,
    rehypePlugins: adaptedRehypePlugins,
  } = collectUserPlugins(config)

  const compiler = new MdxCompiler(
    [...mdastPlugins, ...adaptedRemarkPlugins],
    [...hastPlugins, ...adaptedRehypePlugins],
  )

  return {
    name: 'vite-plugin-boltdocs-satteri-mdx',
    enforce: 'pre',

    async load(id) {
      if (!isMdx(id)) return null

      const [cleanId] = id.split('?')
      let rawCode: string
      try {
        rawCode = fs.readFileSync(cleanId, 'utf-8')
      } catch {
        return null
      }

      const lifecycle = getLifecycle?.()
      let sourceCode = rawCode
      if (lifecycle) {
        try {
          const result = await lifecycle.runChain('transformSource', {
            code: rawCode,
            filePath: cleanId,
          })
          if (result?.code) sourceCode = result.code
        } catch {
          // Lifecycle chain error, continue with raw source
        }
      }

      const compiled = await compiler.compile(sourceCode, cleanId)
      return compiled ?? sourceCode
    },

    async transform(code, id) {
      if (!isMdx(id)) return null

      let finalCode = code as string
      if (!looksCompiled(finalCode)) {
        const compiled = await compiler.compile(finalCode, id.split('?')[0])
        if (compiled) finalCode = compiled
      }

      let codeResult = finalCode
      const lifecycle = getLifecycle?.()
      if (lifecycle) {
        try {
          const result = await lifecycle.runChain('transformMdx', {
            code: finalCode,
            filePath: id.split('?')[0],
          })
          if (result?.code) codeResult = result.code
        } catch {
          // Lifecycle chain error, continue with compiled code
        }
      }

      return { code: codeResult, map: null }
    },

    async buildEnd() {
      await compiler.flushCache()
    },
  }
}
