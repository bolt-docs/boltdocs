/**
 * Build and render contracts.
 *
 * The plugin context in `./plugins` is what a plugin author receives. These are
 * the contracts the framework itself passes between its own stages, extracted so
 * that `@bdocs/core-node` and `@bdocs/ssg` can be separated without either
 * importing the other.
 *
 * Everything here is a plain data shape: a filesystem path is a `string`, and a
 * bundler is described by what it emitted rather than by its own types. That is
 * what keeps this package free of Node, Vite, React, and bundler imports.
 */

/**
 * The manifest a bundler emits after a client or server build.
 *
 * It is a structural description rather than Vite's `Manifest` type: the SSG
 * reads these fields and nothing else, so it does not need the bundler's types
 * to describe it. Naming it structurally is what allows the SSG to be replaced
 * without touching this contract.
 */
export interface ManifestChunk {
  /** The emitted file, relative to the build output directory. */
  file: string
  /** The module this chunk was built from, when the bundler reports it. */
  src?: string
  /** Chunks that must load before this one. */
  imports?: readonly string[]
  /** Chunks reachable only through a dynamic import. */
  dynamicImports?: readonly string[]
  /** Stylesheets this chunk depends on. */
  css?: readonly string[]
  /** Other assets referenced by this chunk. */
  assets?: readonly string[]
}

/** A bundle's manifest, keyed by the chunk's logical name. */
export type Manifest = Record<string, ManifestChunk>

/**
 * Which chunks the server bundle needs for a given entry.
 *
 * The SSG uses this to decide the smallest SSR surface for a page instead of
 * importing the whole server entry, which is the expensive part of a warm
 * rebuild.
 */
export type SSRManifest = Record<string, readonly string[]>

/** Loader data that the static build persisted, keyed by output path. */
export type StaticLoaderDataManifest = Record<string, string>

/**
 * One cached page in the SSG output cache.
 *
 * The fields are exactly what invalidation compares: change one and the entry
 * misses. `contentHash` covers the document, `assetHash` covers the client and
 * server chunks that page renders through, and `mtime` is a cheap pre-filter so
 * an unchanged file never gets hashed.
 */
export interface PageCacheEntry {
  contentHash: string
  mtime: number
  /** Path of the persisted loader data for this page, when it has any. */
  loaderDataFilePath?: string
  /** Identity of the client and server assets this page was rendered with. */
  assetHash?: string
}

/**
 * The identity a route is cached under.
 *
 * Every field participates in the cache key. Splitting them lets an edit to the
 * document invalidate the page without invalidating the routes that share its
 * configuration, and it is what makes an edited build proportional to the
 * change rather than to the size of the site.
 */
export interface RouteCacheIdentity {
  /** Hash of the document source. */
  sourceHash: string
  /** Hash of the parsed frontmatter, so a metadata edit does not recompile. */
  frontmatterHash?: string
  /** Identity of the framework and project code shared by every route. */
  clientIdentity?: string
  /** Identity of the stylesheets this route pulls in. */
  cssIdentity?: string
  /** Identity of the configuration, so a config edit invalidates everything. */
  configIdentity?: string
  /** Identity per plugin that contributed to this route. */
  pluginIdentities?: Readonly<Record<string, string>>
}

/**
 * A stage of the build, handed the identity it produced.
 *
 * `BuildContext` is what makes the pipeline describable without exposing the
 * pipeline: a stage reports what it did and what it emitted, and the orchestrator
 * decides what runs next.
 */
export interface BuildContext {
  /** The documentation root, resolved. */
  docsDir: string
  /** The project root, resolved. */
  rootDir: string
  /** Where static output is written. */
  outDir: string
  /** The modes the build is running for. */
  mode: 'development' | 'production'
  /** Routes known at the start of this stage. */
  routes: readonly import('./routes').RouteMeta[]
  /** Emitted bundles, when the stage produced them. */
  manifest?: Manifest
  /** Server-side chunk requirements, when the stage produced them. */
  ssrManifest?: SSRManifest
}

/**
 * What a renderer receives for one route.
 *
 * The SSG renders every page with the same renderer, so this is the whole
 * surface a page needs: which document, which layout, and where its output goes.
 */
export interface RenderContext<Route = import('./routes').RouteMeta> {
  /** The route being rendered. */
  route: Route
  /** Path the output is written to. */
  outPath: string
  /** The public base, so assets resolve from the document root. */
  base?: string
  /** The identity this page is cached under, when it is cacheable. */
  identity?: RouteCacheIdentity
}

/** The result of rendering one route. */
export interface RenderResult {
  /** The route that was rendered. */
  routePath: string
  /** Where the HTML was written, relative to the output directory. */
  outPath: string
  /** Whether the page was rendered or served from cache. */
  source: 'rendered' | 'cached'
}
