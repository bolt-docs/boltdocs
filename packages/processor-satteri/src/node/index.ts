import type { BoltdocsPlugin } from 'boltdocs'
import { satteriRemarkMetaPlugin } from './satteri-plugins/remark-meta-plugin'
import { satteriRehypeSlugPlugin } from './satteri-plugins/rehype-slug-plugin'
import { satteriRehypeShikiPlugin } from './satteri-plugins/rehype-shiki-plugin'
import type { MdastPluginInput, HastPluginInput } from 'satteri'

/**
 * Internal Sätteri-specific plugin type that includes MDAST/HAST plugin arrays
 * not present on the public BoltdocsPlugin interface.
 */
interface SatteriProcessorPlugin extends BoltdocsPlugin {
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
export { createSatteriMdxPlugin } from './satteri-mdx-plugin'
