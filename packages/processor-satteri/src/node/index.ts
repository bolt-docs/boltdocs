import type { BoltdocsPlugin } from 'boltdocs'
import { satteriRemarkMetaPlugin } from './satteri-plugins/remark-meta-plugin'
import { satteriRehypeSlugPlugin } from './satteri-plugins/rehype-slug-plugin'
import { satteriRehypeShikiPlugin } from './satteri-plugins/rehype-shiki-plugin'

/**
 * Creates a Sätteri processor plugin.
 * Used internally by core when --turbo flag is active.
 */
export function createSatteriProcessorPlugin(): BoltdocsPlugin {
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
