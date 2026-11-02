/**
 * Assertion helper used across the SSG pipeline.
 *
 * Two problems with the previous version, both of which `tsc` rejected:
 *
 *   - The overload signatures were not exported while the implementation was,
 *     and TypeScript requires an overload set to agree on that.
 *   - They were declared at all. A call site passes whatever it has; the
 *     narrowing `asserts value` is what callers actually want, and it is not
 *     reachable through an unexported signature.
 *
 * Exported, both halves are usable, and the file compiles.
 */

/** Narrows a falsy `boolean` — the `if (!x) invariant(x)` shape. */
export function invariant(value: boolean, message?: string): asserts value

/** Narrows a possibly-absent value to present. */
export function invariant<T>(
  value: T | null | undefined,
  message?: string,
): asserts value is T

export function invariant(value: unknown, message?: string) {
  if (value === false || value === null || typeof value === 'undefined') {
    console.error(
      'The following error is a bug in Boltdocs SSG; please open an issue! https://github.com/bolt-docs/boltdocs/issues/new',
    )
    throw new Error(message)
  }
}

export default invariant
