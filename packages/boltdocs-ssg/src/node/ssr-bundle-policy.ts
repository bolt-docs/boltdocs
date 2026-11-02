/**
 * Keep framework internals and Helmet inside the worker bundle. React and
 * ReactDOM remain external because they are required peers of Boltdocs and
 * should resolve to the consumer's singleton React runtime. Other bare
 * dependencies are externalized so workers do not parse them repeatedly.
 *
 * Helmet is a runtime dependency of @bdocs/ssg rather than a peer dependency.
 * Bundling it keeps generated SSR entries self-contained in strict pnpm,
 * npm, and ESM/CJS consumer layouts.
 */
export const SSR_BUNDLED_PACKAGE_PATTERNS = [
  /^@bdocs\//,
  /^boltdocs(?:\/|$)/,
  /^react-helmet-async(?:\/|$)/,
] as const

/**
 * Keep these as package names instead of regular expressions. Rolldown's
 * native Vite 8 binding accepts string package entries for `ssr.external`;
 * package entries also cover their subpath imports (for example
 * `react-dom/server`).
 */
export const SSR_EXTERNAL_PACKAGE_NAMES = ['react', 'react-dom'] as const
