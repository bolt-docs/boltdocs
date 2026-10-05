/**
 * `boltdocs/client/primitives` — the layout-level primitives.
 *
 * A separate entry from the theme's main one, and not a re-export of it: the
 * primitives barrel reaches the search dialog, which is behind a dynamic import
 * on purpose. Routing it through `index` turned that lazy chunk into part of the
 * first visit.
 */
export * from '@bdocs/theme-neutral/components/primitives'
