/**
 * @bdocs/unist-utils
 *
 * Public surface of strictly-typed unist/mdast/hast utilities used by
 * Boltdocs core, every official `@bdocs/*` plugin and the Sätteri MDX
 * processor. See CHANGELOG.md and AGENTS.md for migration notes.
 *
 * Importing from this barrel keeps plugin authors free from
 * deep-package-path churn when files move internally.
 */

// MDX node constants + traversal control flow.
export * from './mdx-nodes'

// AST node types + type guards.
export * from './types'

// Meta parser.
export * from './meta'

// Visitors.
export * from './visit'

// hProperties helpers.
export * from './h-properties'

// Builders.
export * from './builders'

// Class-list manipulation.
export * from './class-list'
