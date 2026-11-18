/**
 * The theme uses the primitive's class-name joiner so there is a single
 * implementation across the UI layer. It intentionally has no `clsx` semantics
 * (nested arrays and objects): no call site in this package needs them, and
 * keeping one function means the same falsy values are dropped everywhere.
 */
export { cn } from '@bdocs/primitives'
