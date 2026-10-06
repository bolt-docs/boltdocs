/**
 * `boltdocs/client/primitives` — the style-neutral slot layer.
 *
 * A separate entry from the theme's main one, and not a re-export of it: the
 * composition barrel reaches the search dialog, which is behind a dynamic import
 * on purpose. Routing it through `index` turned that lazy chunk into part of the
 * first visit.
 *
 * The name of this entry is the one it had in `3.x`, when the layer it re-exports
 * was called `primitives`. That word now belongs to `@bdocs/primitives`, the
 * behaviour package this layer is built on, so the source calls it `composition`.
 */
export * from '@bdocs/theme-neutral/composition'
