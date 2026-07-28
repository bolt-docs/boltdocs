import type { ViteReactSSGContext } from '../types'

/**
 * Shared types for the SSG build pipeline. These used to live in build.ts but
 * are also needed by helper modules (assets, client-dep-map, performance).
 * Keeping them in a leaf module breaks the import cycle between build.ts and
 * those helpers.
 */

export type SSRManifest = Record<string, string[]>

export interface ManifestItem {
  css?: string[]
  file: string
  imports?: string[]
  dynamicImports?: string[]
  src?: string
  assets?: string[]
}

export type Manifest = Record<string, ManifestItem>

export interface SsgCacheItem {
  mtime: number
  loaderDataFilePath?: string
  assetHash?: string
}

export type StaticLoaderDataManifest = Record<string, string>

export type CreateRootFactory = (
  client: boolean,
  routePath?: string,
) => Promise<ViteReactSSGContext<true> | ViteReactSSGContext<false>>
