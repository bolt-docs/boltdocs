/**
 * `boltdocs/ssg` — the static-site generator's client entry.
 *
 * The engine owns the SSG pipeline, and the pipeline needs a browser-side
 * component to mount the app. That component lives in `@bdocs/ssg`, and this
 * subpath re-exports it so a generated entry can reach it through the package
 * the site already depends on.
 *
 * It is the only client-shaped thing the engine still publishes. The UI layer
 * — the layout, the components, the routes — belongs to a theme package, and a
 * site installs one.
 */
export { ViteReactSSG } from '@bdocs/ssg'
export type {
  ViteReactSSGClientOptions,
  ViteReactSSGContext,
} from '@bdocs/ssg'
