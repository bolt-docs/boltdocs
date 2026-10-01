import type { ViteReactSSGContext } from '../types'
import type {
  Manifest,
  PageCacheEntry,
  SSRManifest,
  StaticLoaderDataManifest,
} from '@bdocs/contracts'

/**
 * Shared types for the SSG build pipeline. These used to live in build.ts but
 * are also needed by helper modules (assets, client-dep-map, performance).
 * Keeping them in a leaf module breaks the import cycle between build.ts and
 * those helpers.
 *
 * The manifest and cache shapes come from `@bdocs/contracts`. They were
 * previously declared twice inside this package, and the two copies had drifted:
 * the one here was missing `contentHash`, which is the field the cache
 * compares. A contract layer only earns its place when the packages consume it,
 * so these re-export rather than redeclare.
 */

export type { Manifest, PageCacheEntry, SSRManifest, StaticLoaderDataManifest }

export interface ManifestItem {
  css?: string[]
  file: string
  imports?: string[]
  dynamicImports?: string[]
  src?: string
  assets?: string[]
}

/**
 * The cache entry this package writes. Aliased rather than redeclared so the
 * contract and the implementation cannot drift again.
 */
export type SsgCacheItem = PageCacheEntry

export type CreateRootFactory = (
  client: boolean,
  routePath?: string,
) => Promise<ViteReactSSGContext<true> | ViteReactSSGContext<false>>
