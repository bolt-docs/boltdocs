/**
 * The theme's routing and rendering surface.
 *
 * `createRoutes` builds the route table the app renders: the documentation
 * tree, the collection routes, the external pages and the redirect entries.
 * It lives in the theme because every route element it produces is a theme
 * component — the layout, the 404, the collection list. A core that built them
 * would have to know what a theme looks like, which is the coupling the 4.0
 * package graph exists to remove.
 *
 * The router primitives it uses come from `@bdocs/runtime`; the theme composes
 * them, it does not own them.
 */
export { createRoutes } from './create-routes'
export { BoltdocsShell } from './boltdocs-shell'
export { MdxPage } from './mdx-page'
export type { CreateRoutesOptions } from './create-routes'
