/**
 * `boltdocs/client/mdx` — the MDX components.
 *
 * A named list rather than `export *` from the theme. The theme's main entry
 * also exports the layout primitives, and `Callout`, `Image` and `Card` exist in
 * both, so a wildcard would either collide or silently pick one. A site resolving
 * `boltdocs/client/mdx` wants the MDX ones.
 */
export { Card, Cards, Callout, Field, Image } from '@bdocs/theme-neutral'
