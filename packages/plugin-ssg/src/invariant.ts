function invariant(value: boolean, message?: string): asserts value

function invariant<T>(
  value: T | null | undefined,
  message?: string,
): asserts value is T

export default function invariant(value: any, message?: string) {
  if (value === false || value === null || typeof value === 'undefined') {
    console.error(
      'The following error is a bug in Boltdocs SSG; please open an issue! https://github.com/bolt-docs/boltdocs/issues/new',
    )
    throw new Error(message)
  }
}
