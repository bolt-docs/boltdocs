import { satteriRemarkMetaPlugin } from './satteri-plugins/remark-meta-plugin'
import { satteriRehypeSlugPlugin } from './satteri-plugins/rehype-slug-plugin'
import { satteriRehypeShikiPlugin } from './satteri-plugins/rehype-shiki-plugin'
import type { MdastPluginInput, HastPluginInput } from 'satteri'

/**
 * Internal plugin type that includes MDAST/HAST plugin arrays.
 * Used to pass plugin definitions from the processor to the main plugin.
 */
export interface SatteriProcessorPlugin {
  name: string
  version: string
  boltdocsVersion: string
  mdastPlugins: MdastPluginInput[]
  hastPlugins: HastPluginInput[]
}

/**
 * Creates a Sätteri processor plugin.
 * Used internally by core when --turbo flag is active.
 */
export function createSatteriProcessorPlugin(): SatteriProcessorPlugin {
  return {
    name: 'boltdocs-processor-satteri',
    version: '0.1.0',
    boltdocsVersion: '>=3.0.0',
    mdastPlugins: [satteriRemarkMetaPlugin()],
    hastPlugins: [satteriRehypeSlugPlugin(), satteriRehypeShikiPlugin()],
  }
}

// Named export for core dynamic import
export {
  createSatteriMdxPlugin,
  invalidateMdxFileCache,
  resetMdxRuntimeCaches,
} from './satteri-mdx-plugin'

// P2-22: Compile pool for parallel MDX compilation
export { CompilePool } from './compile-pool'
export type { CompileRequest, CompileResult, PoolMetrics } from './compile-pool'

// P2-21: Precompile bridge for early pipeline precompile
export {
  setPrecompilePromise,
  getPrecompilePromise,
  isPrecompileStarted,
  resetPrecompileBridge,
  signalEarlyPrecompile,
  wasEarlyPrecompileSignaled,
} from './precompile-bridge'
