/**
 * The router, and nothing else.
 *
 * A separate entry rather than a slice of the main barrel because
 * `boltdocs/client/router` is a public subpath: widening it to `export *` from
 * the whole runtime would silently start exporting themes, i18n helpers and the
 * config context from a path whose name promises a router.
 */
export * from './router'
