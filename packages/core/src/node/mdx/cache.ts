import { TransformCache } from '../cache'

/**
 * Version identifier for the MDX plugin to invalidate cache if logic changes.
 */
export const MDX_PLUGIN_VERSION = 'v3'

/**
 * Persistent cache for MDX transformations.
 * Saves results to `.boltdocs/transform-mdx.json.gz`.
 */
export const mdxCache = new TransformCache('mdx')
