/**
 * The browser-facing half of Boltdocs.
 *
 * Routing, navigation, hydration and the client contexts live here rather than
 * in the core package, because none of it needs the filesystem, Vite, or any of
 * the build-time integrations. That boundary is what lets a theme, a custom
 * layout, or a plugin render against the runtime without importing the engine
 * that produced the page.
 *
 * Nothing in this package may import `node:*`, Vite, Sharp, Piscina, or a
 * `virtual:boltdocs-*` module. The first four do not exist in a browser, and the
 * last is resolved by the build pipeline, so anything depending on it belongs in
 * the core.
 */
export * from './contract-types'
export * from './types'

export * from './config-context'
export * from './doc-route-context'
export * from './mdx-components-context'
export * from './routes-context'
export * from './theme-context'
export * from './ui-context'

export * from './router'

export { normalizePath, resolvePublicAssetUrl } from './path'
export * from './i18n'
export * from './view-transitions'
export * from './site-bridge'
