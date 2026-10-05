/**
 * `boltdocs/client` — the public client surface.
 *
 * Now a composition of the three packages that own it: the theme, the runtime
 * and the SSG pipeline. All three used to be this one file's worth of core, and
 * a consumer of `boltdocs/client` sees exactly the names it saw before.
 *
 * The order matters only for name collisions, of which there are none today. If
 * a theme and a future second theme were ever both reachable from here, that
 * would be the bug to look at.
 */
export * from '@bdocs/theme-neutral'
export * from '@bdocs/runtime'
export * from './ssg'
