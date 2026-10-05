import type { ComponentType, ReactNode } from 'react'
import type { ComponentRoute } from './types'

/**
 * The per-site build artifacts the UI layer needs at runtime.
 *
 * Two things the interface needs are generated per site by the Boltdocs Vite
 * pipeline: the icon registry, built from the author's `icons.tsx` if they wrote
 * one, and the page-source fetcher that backs "copy as Markdown". They arrive as
 * `virtual:boltdocs-*` modules, and a module resolved by a Vite plugin cannot
 * exist inside a standalone package.
 *
 * That matters because a theme has to be installable on its own. `@bdocs/core`
 * is the only package that can resolve a virtual module, so it reads them and
 * hands them over here; the theme reads them back through these functions and
 * never mentions a virtual module at all. The dependency points the safe way:
 * core knows about the theme's needs, and the theme knows nothing about the build.
 *
 * Stored on `globalThis` under a `Symbol.for` key, the same way `ConfigContext`
 * survives being mounted twice in two module instances. A page rendering a
 * component preview inside itself ends up with two copies of the theme package,
 * and a module-local variable would leave the inner copy with nothing.
 */

/** An icon as a site's `icons.tsx` exports one. */
export type SiteIcon = ComponentType<{
  className?: string
  size?: number | string
}>

export interface SiteBridge {
  /**
   * Icons keyed by PascalCase name. Empty when the site has no `icons.tsx`,
   * which is the default: an `Icon` lookup then misses loudly rather than
   * rendering something subtly wrong.
   */
  icons: Record<string, SiteIcon>
  /**
   * Fetches the raw Markdown of the current route, for "copy as Markdown".
   * Rejects when the build did not emit page source; the caller already treats
   * that as "no source available".
   */
  fetchPageSource: (options?: {
    bustCache?: boolean
  }) => Promise<Record<string, string>>
  /** Loads the built search index. Rejects when the site has no index. */
  fetchSearchData: (options?: {
    bustCache?: boolean
  }) => Promise<SiteSearchItem[]>
  /**
   * The site's own `layout.tsx`, when it wrote one. Absent by default, and the
   * default layout renders without it.
   */
  layout?: ComponentType<{
    children: ReactNode
    /**
     * The route the shell resolved. Typed as the full `ComponentRoute` because
     * that is what is actually passed and a layout written against it must
     * compile. Rely on `path`, `title`, `description`, `locale`, `version` and
     * `collection` only — the rest, `componentPath` and `frontmatter` among
     * them, exist during a build and are not something a published page can
     * depend on.
     */
    route?: ComponentRoute
  }>
  /**
   * Plugin-contributed client slots, keyed by insertion point. Empty by
   * default; a plugin that contributes nothing leaves no key behind rather than
   * a key with nothing in it.
   */
  clientSlots: Record<string, SiteSlot[]>
}

/** One plugin-provided client slot. */
export interface SiteSlot {
  id: string
  load: () => Promise<{ default: ComponentType }>
}

/**
 * One entry in the generated search index.
 *
 * Copied from the declaration of `virtual:boltdocs-search` rather than guessed,
 * so the shape the UI consumes and the shape the build emits cannot drift apart
 * unnoticed.
 */
export interface SiteSearchItem {
  id: string
  title: string
  content: string
  url: string
  display: string
  locale?: string
  version?: string
}

const SITE_BRIDGE_SYMBOL = Symbol.for('__BDOCS_SITE_BRIDGE__')

const registry = globalThis as Record<PropertyKey, unknown>

/** The no-site default: no icons, and page source is simply unavailable. */
const unavailable = (what: string) => () => Promise.reject(new Error(what))

const EMPTY_BRIDGE: SiteBridge = {
  icons: {},
  fetchPageSource: unavailable(
    'Page source is unavailable',
  ) as SiteBridge['fetchPageSource'],
  fetchSearchData: unavailable(
    'Search is not available',
  ) as SiteBridge['fetchSearchData'],
  clientSlots: {},
}

/**
 * Hands the generated artifacts to the UI layer.
 *
 * Called once by the core while it renders. Partial input is merged over what is
 * already there rather than replacing it, so two callers registering different
 * halves do not clobber each other.
 */
export function registerSiteBridge(parts: Partial<SiteBridge>): void {
  const current =
    (registry[SITE_BRIDGE_SYMBOL] as SiteBridge | undefined) ?? EMPTY_BRIDGE
  registry[SITE_BRIDGE_SYMBOL] = { ...current, ...parts }
}

/**
 * The registered artifacts, or the no-site default.
 *
 * Never throws. A component preview rendered outside a Boltdocs shell is a
 * supported thing to do, and it should show an unstyled page rather than crash.
 */
export function getSiteBridge(): SiteBridge {
  return (
    (registry[SITE_BRIDGE_SYMBOL] as SiteBridge | undefined) ?? EMPTY_BRIDGE
  )
}

/** The site's icon registry, empty when the site defined none. */
export function getSiteIcons(): Record<string, SiteIcon> {
  return getSiteBridge().icons
}

/**
 * The page-source fetcher.
 *
 * Rejects when unavailable; every caller already handles that by degrading, so
 * the rejection is the signal rather than a silent empty object that looks like
 * a page with no content.
 */
export function getPageSourceFetcher(): SiteBridge['fetchPageSource'] {
  return getSiteBridge().fetchPageSource
}

/** The search-index fetcher. Rejects when the site has no search index. */
export function getSearchDataFetcher(): SiteBridge['fetchSearchData'] {
  return getSiteBridge().fetchSearchData
}

/** The site's `layout.tsx`, or undefined when it wrote none. */
export function getSiteLayout(): SiteBridge['layout'] {
  return getSiteBridge().layout
}

/** Plugin-contributed client slots. Empty, never undefined, when there are none. */
export function getClientSlots(): Record<string, SiteSlot[]> {
  return getSiteBridge().clientSlots
}

/** Test-only: forgets anything a previous test registered. */
export function resetSiteBridge(): void {
  registry[SITE_BRIDGE_SYMBOL] = undefined
}
