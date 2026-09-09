export function normalizeMdxPath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\/+/, '')
}

export function matchesMdxUpdatePath(
  routeFilePath: string,
  updateRelativePath: string,
): boolean {
  return (
    normalizeMdxPath(routeFilePath) === normalizeMdxPath(updateRelativePath)
  )
}
