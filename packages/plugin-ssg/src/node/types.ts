import type { ViteReactSSGContext } from '../types'
import type {
  Manifest,
  ManifestChunk,
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

/**
 * One entry in a bundle manifest.
 *
 * The third copy of this shape, and the drift had already reached `tsc`: the
 * contract declares `readonly string[]` for the file lists — it has to, because
 * the bundler hands them over frozen — and this package's own version declared
 * mutable arrays, so every place that read a manifest chunk was a type error.
 * Aliasing the contract instead of restating it is the fix that cannot come
 * back.
 */
export type ManifestItem = ManifestChunk

/**
 * The cache entry this package writes. Aliased rather than redeclared so the
 * contract and the implementation cannot drift again.
 */
export type SsgCacheItem = PageCacheEntry

export type CreateRootFactory = (
  client: boolean,
  routePath?: string,
) => Promise<ViteReactSSGContext<true> | ViteReactSSGContext<false>>
