import type { RouteMeta } from '@bdocs/contracts'

/**
 * Search index registry.
 *
 * The core does not generate search documents. It knows only that some engine
 * may want them: it hands over the routes it has, and publishes whatever comes
 * back as `search.json`.
 *
 * ## Why a registry rather than a dependency
 *
 * A direct `dependencies` entry on `@bdocs/plugin-search` would be a cycle —
 * the plugin needs `boltdocs` for its config types and the core needs the
 * generator — and pnpm reports cyclic workspace dependencies rather than
 * resolving them. Worse, it would make the generator unavoidable: every site
 * would carry a search implementation whether or not it shipped a search box,
 * which is the coupling the 4.0 roadmap set out to remove ("`@bdocs/core-node`
 * … will not import optional integrations such as … **Search**").
 *
 * So the dependency runs the other way. The plugin is a dependency of a site
 * that configures it, and it registers itself here when loaded. A site with no
 * search plugin gets no `search.json`, and is told so once instead of failing.
 */

/**
 * One unit of search output.
 *
 * Distinct from `SearchDocument` in `@bdocs/contracts`, which is the *input* an
 * engine plugin receives before any transformation. This one is what reaches
 * the browser: it has `url` (deep link, fragment included) and `display`
 * (breadcrumb) rather than a path plus raw frontmatter, because the query layer
 * renders `display` and navigates to `url` and needs nothing else.
 *
 * The two shapes stay separate on purpose. An engine plugin should not have to
 * re-derive the breadcrumb, and the runtime asset should not carry frontmatter
 * no query engine reads.
 */
export interface SearchResultDocument {
  id: string
  title: string
  content: string
  url: string
  display: string
  locale?: string
  version?: string
}

/** Produces the documents an engine indexes. */
export type SearchDataGenerator = (
  routes: RouteMeta[],
) => SearchResultDocument[]

let generator: SearchDataGenerator | null = null

/**
 * Register the search document generator.
 *
 * The first registration wins. A second one would mean two plugins generating
 * `search.json`, and which file reached the browser would depend on plugin load
 * order — the same reasoning as `registerPluginHighlighter`, which also refuses
 * to overwrite.
 */
export function registerSearchGenerator(fn: SearchDataGenerator): void {
  if (generator) return
  generator = fn
}

/** The registered generator, or null when no search plugin is configured. */
export function getSearchGenerator(): SearchDataGenerator | null {
  return generator
}

/**
 * Whether a search plugin is present.
 *
 * Distinct from "the generator is registered": during `plugins.forEach` a
 * plugin may be mid-registration, and the build warns once after all plugins
 * are loaded rather than at the moment it notices.
 */
export function hasSearchGenerator(): boolean {
  return generator !== null
}

/**
 * Generate search documents for the given routes, or `null` when no plugin
 * registered a generator.
 *
 * Returning null rather than an empty array is deliberate: "no search plugin"
 * and "a search plugin over zero routes" must not be indistinguishable, because
 * only the first is worth warning about.
 */
export function buildSearchData(routes: RouteMeta[]): SearchDocument[] | null {
  // An engine's entries replace the generated ones rather than merging with
  // them: merging would publish records from two different index shapes into one
  // asset, and a client reading `display` or `url` would find some entries
  // missing them.
  if (engineEntries) return engineEntries
  if (!generator) return null
  try {
    return generator(routes)
  } catch {
    // A generator that throws would otherwise take down every route generate
    // and take the whole build with it. A missing search index degrades the
    // dialog; a failed build does not.
    return null
  }
}

/**
 * Entries published by an engine plugin through the `search:index` hook.
 *
 * Separate from the generator: a generator produces entries from routes, an
 * engine plugin hands them over ready-made. Both end up in the same asset, and
 * the engine wins when both are present — a site that configured an engine asked
 * for that engine's index, not the default one.
 */
let engineEntries: SearchResultDocument[] | null = null

export function setSearchEntries(entries: SearchResultDocument[] | null): void {
  engineEntries = entries
}

export function getSearchEntries(): SearchResultDocument[] | null {
  return engineEntries
}

/** Test seam: forget the registered generator. */
export function resetSearchRegistry(): void {
  generator = null
  engineEntries = null
}
