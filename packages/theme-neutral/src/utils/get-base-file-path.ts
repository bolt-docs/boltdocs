/**
 * Get the base file path by removing version and locale prefixes.
 * @param filePath - The full file path.
 * @param version - The version to remove from the path.
 * @param locale - The locale to remove from the path.
 * @returns The base file path.
 */
export function getBaseFilePath(
  filePath: string,
  version: string | undefined,
  locale: string | undefined,
): string {
  let path = filePath
  if (version && (path === version || path.startsWith(`${version}/`))) {
    path = path === version ? 'index.md' : path.slice(version.length + 1)
  }
  if (locale && (path === locale || path.startsWith(`${locale}/`))) {
    path = path === locale ? 'index.md' : path.slice(locale.length + 1)
  }
  return path
}
